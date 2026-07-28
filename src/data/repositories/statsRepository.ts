import { DAILY_TRACKS, type DailyTrack } from "@/domain/daily";
import { NEW_GAME_DIFFICULTIES, type Difficulty } from "@/domain/sudoku/types";

import { getDatabase, withWriteLock } from "../db/client";

export type DifficultyStat = {
  completed: number;
  /** Fastest completion in seconds, or null if none. */
  bestSeconds: number | null;
  /** Mean completion time in seconds (rounded), or null if none. */
  averageSeconds: number | null;
};

export type CompletedGameStats = {
  totalCompleted: number;
  mistakeFreeCompleted: number;
  /** Total time spent on completed games, in seconds. */
  totalSeconds: number;
  byDifficulty: Record<Difficulty, DifficultyStat>;
};

export type DailyTrackStat = {
  completed: number;
  /** Fastest completion in seconds, or null if none. */
  bestSeconds: number | null;
  /** Mean completion time in seconds (rounded), or null if none. */
  averageSeconds: number | null;
  mistakeFreeCompleted: number;
  /** Total time spent on completed days for this track, in seconds. */
  totalSeconds: number;
};

export type RecentGame = {
  id: string;
  gameId: string;
  difficulty: Difficulty;
  dateKey: string | null;
  dailyTrack: DailyTrack | null;
  elapsedSeconds: number;
  mistakes: number;
  hintsUsed: number;
  completedAt: string;
  /**
   * False for an older run of a puzzle that was subsequently restarted. The
   * summary remains historically correct, but the retained games row now holds
   * the newer board and must not be opened as though it were the old result.
   */
  canReopen: boolean;
};

export type RecentGameFilter = "all" | "daily" | "easy" | "medium" | "hard" | "expert";

export type RecentGameQuery = {
  limit?: number;
  offset?: number;
  filter?: RecentGameFilter;
};

type AggregateRow = {
  difficulty: string;
  completed: number;
  best: number | null;
  avg: number | null;
  total: number | null;
  mistake_free: number;
};

type DailyAggregateRow = {
  track: string;
  completed: number;
  best: number | null;
  avg: number | null;
  total: number | null;
  mistake_free: number;
};

type RecentGameRow = {
  id: string;
  game_id: string;
  difficulty: string;
  date_key: string | null;
  daily_track: string | null;
  elapsed_seconds: number;
  mistakes: number;
  hints_used: number;
  completed_at: string;
  can_reopen: number;
};

function emptyByDifficulty(): Record<Difficulty, DifficultyStat> {
  return Object.fromEntries(
    NEW_GAME_DIFFICULTIES.map((d) => [
      d,
      { completed: 0, bestSeconds: null, averageSeconds: null },
    ]),
  ) as Record<Difficulty, DifficultyStat>;
}

/**
 * Aggregate completed-game stats for ordinary games only. Daily games carry a
 * `date_key` (and are reported separately via {@link getDailyTrackStats}), so
 * `date_key IS NULL` keeps the Normal bucket from double-counting them.
 */
export async function getCompletedGameStats(): Promise<CompletedGameStats> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<AggregateRow>(
    `SELECT difficulty,
            COUNT(*) AS completed,
            MIN(elapsed_seconds) AS best,
            AVG(elapsed_seconds) AS avg,
            SUM(elapsed_seconds) AS total,
            SUM(CASE WHEN mistakes = 0 THEN 1 ELSE 0 END) AS mistake_free
       FROM completed_games
      WHERE date_key IS NULL
      GROUP BY difficulty`,
  );

  const byDifficulty = emptyByDifficulty();
  let totalCompleted = 0;
  let mistakeFreeCompleted = 0;
  let totalSeconds = 0;

  for (const row of rows) {
    totalCompleted += row.completed;
    mistakeFreeCompleted += row.mistake_free;
    totalSeconds += row.total ?? 0;
    if ((NEW_GAME_DIFFICULTIES as readonly string[]).includes(row.difficulty)) {
      byDifficulty[row.difficulty as Difficulty] = {
        completed: row.completed,
        bestSeconds: row.best,
        averageSeconds: row.avg == null ? null : Math.round(row.avg),
      };
    }
  }

  return { totalCompleted, mistakeFreeCompleted, totalSeconds, byDifficulty };
}

function emptyByTrack(): Record<DailyTrack, DailyTrackStat> {
  return Object.fromEntries(
    DAILY_TRACKS.map((t) => [
      t,
      {
        completed: 0,
        bestSeconds: null,
        averageSeconds: null,
        mistakeFreeCompleted: 0,
        totalSeconds: 0,
      },
    ]),
  ) as Record<DailyTrack, DailyTrackStat>;
}

/**
 * Aggregate completed daily stats per track, straight from `daily_progress`
 * (the authoritative per-day record, which carries `track` so we don't have to
 * infer it from difficulty).
 */
export async function getDailyTrackStats(): Promise<Record<DailyTrack, DailyTrackStat>> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<DailyAggregateRow>(
    `SELECT track,
            COUNT(*) AS completed,
            MIN(elapsed_seconds) AS best,
            AVG(elapsed_seconds) AS avg,
            SUM(elapsed_seconds) AS total,
            SUM(CASE WHEN mistakes = 0 THEN 1 ELSE 0 END) AS mistake_free
       FROM daily_progress
      WHERE completed_at IS NOT NULL
      GROUP BY track`,
  );

  const byTrack = emptyByTrack();
  for (const row of rows) {
    if ((DAILY_TRACKS as readonly string[]).includes(row.track)) {
      byTrack[row.track as DailyTrack] = {
        completed: row.completed,
        bestSeconds: row.best,
        averageSeconds: row.avg == null ? null : Math.round(row.avg),
        mistakeFreeCompleted: row.mistake_free,
        totalSeconds: row.total ?? 0,
      };
    }
  }

  return byTrack;
}

/**
 * Most recent completed runs across ordinary and daily play. No migration is
 * required: completed_games owns the immutable run summary, while games retains
 * the solved board for the latest run of a puzzle.
 */
export async function getRecentGames({
  limit = 20,
  offset = 0,
  filter = "all",
}: RecentGameQuery = {}): Promise<RecentGame[]> {
  const db = await getDatabase();
  const normalizedLimit = Math.trunc(limit);
  const safeLimit = Number.isFinite(normalizedLimit)
    ? Math.min(100, Math.max(1, normalizedLimit))
    : 20;
  const normalizedOffset = Math.trunc(offset);
  const safeOffset = Number.isFinite(normalizedOffset) ? Math.max(0, normalizedOffset) : 0;
  const filterSql =
    filter === "daily"
      ? "AND (cg.date_key IS NOT NULL OR g.shared_daily_track IS NOT NULL)"
      : filter === "all"
        ? ""
        : "AND cg.difficulty = ?";
  const filterParams = filter === "all" || filter === "daily" ? [] : [filter];
  const rows = await db.getAllAsync<RecentGameRow>(
    `SELECT cg.id,
            cg.game_id,
            cg.difficulty,
            COALESCE(cg.date_key, g.shared_daily_date_key) AS date_key,
            COALESCE(dp.track, g.shared_daily_track) AS daily_track,
            cg.elapsed_seconds,
            cg.mistakes,
            cg.hints_used,
            cg.completed_at,
            CASE WHEN g.completed_at = cg.completed_at THEN 1 ELSE 0 END AS can_reopen
       FROM completed_games cg
       LEFT JOIN games g ON g.id = cg.game_id
       LEFT JOIN daily_progress dp ON dp.game_id = cg.game_id
      WHERE 1 = 1
      ${filterSql}
      ORDER BY cg.completed_at DESC, cg.id DESC
      LIMIT ? OFFSET ?`,
    ...filterParams,
    safeLimit,
    safeOffset,
  );

  return rows.map((row) => ({
    id: row.id,
    gameId: row.game_id,
    difficulty: row.difficulty as Difficulty,
    dateKey: row.date_key,
    dailyTrack: (row.daily_track as DailyTrack | null) ?? null,
    elapsedSeconds: row.elapsed_seconds,
    mistakes: row.mistakes,
    hintsUsed: row.hints_used,
    completedAt: row.completed_at,
    canReopen: row.can_reopen === 1,
  }));
}

/** Number of completed runs, used by post-completion review eligibility. */
export async function getCompletedGameCount(): Promise<number> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ count: number }>(
    "SELECT COUNT(*) AS count FROM completed_games",
  );
  return row?.count ?? 0;
}

/**
 * Wipe all stats history: completed games and daily progress (which drives the
 * streak). Active/paused games are left alone. Dev/settings affordance.
 */
export async function resetStats(): Promise<void> {
  await withWriteLock(async () => {
    const db = await getDatabase();
    await db.withExclusiveTransactionAsync(async (txn) => {
      await txn.runAsync("DELETE FROM completed_games");
      await txn.runAsync("DELETE FROM daily_progress");
    });
  });
}

/** Local "YYYY-MM-DD" key (mirrors services/dailyService.getLocalDateKey). */
function localDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * How many completed games to seed per (normal) difficulty, with a base solve
 * time (s). Extreme is never an ordinary completion — it only arrives via the
 * Daily Challenge track, seeded separately below.
 */
const SEED_PER_DIFFICULTY: Partial<Record<Difficulty, { count: number; base: number }>> = {
  easy: { count: 12, base: 240 },
  medium: { count: 8, base: 420 },
  hard: { count: 5, base: 700 },
  expert: { count: 3, base: 1100 },
};

/** Length of the daily streak the seeder fabricates, ending today. */
const SEED_STREAK_DAYS = 7;
/** How many recent Daily Challenge (extreme) days the seeder fabricates. */
const SEED_CHALLENGE_DAYS = 4;
const MS_PER_DAY = 86_400_000;

/**
 * Dev-only: replace all stats with a realistic spread of completed games across
 * difficulties plus a multi-day daily streak ending today, so the Stats screen
 * and completion UI can be exercised without grinding puzzles. Clears first so
 * repeated taps are deterministic. See components/DevTools.tsx.
 */
export async function seedSampleStats(): Promise<void> {
  const now = new Date();
  await withWriteLock(async () => {
    const db = await getDatabase();
    await db.withExclusiveTransactionAsync(async (txn) => {
      await txn.runAsync("DELETE FROM completed_games");
      await txn.runAsync("DELETE FROM daily_progress");

      let n = 0;
      const completedGameInserts: Promise<unknown>[] = [];
      for (const difficulty of NEW_GAME_DIFFICULTIES) {
        const seed = SEED_PER_DIFFICULTY[difficulty];
        if (!seed) {
          continue;
        }
        const { count, base } = seed;
        for (let i = 0; i < count; i++) {
          const elapsed = Math.max(60, base + i * 37 - (i % 3) * 50);
          const mistakes = i % 4 === 0 ? 0 : i % 3;
          completedGameInserts.push(
            txn.runAsync(
              `INSERT INTO completed_games
               (id, game_id, puzzle_id, difficulty, date_key, elapsed_seconds, mistakes, hints_used, completed_at)
             VALUES (?, ?, ?, ?, NULL, ?, ?, ?, ?)`,
              `dev-${difficulty}-${i}`,
              `dev-game-${n}`,
              `dev-puzzle-${n}`,
              difficulty,
              elapsed,
              mistakes,
              i % 5,
              now.toISOString(),
            ),
          );
          n++;
        }
      }
      await Promise.all(completedGameInserts);

      const dailyProgressInserts = Array.from({ length: SEED_STREAK_DAYS }, (_, i) => {
        const day = new Date(now.getTime() - i * MS_PER_DAY);
        const dateKey = localDateKey(day);
        return txn.runAsync(
          `INSERT OR REPLACE INTO daily_progress
           (date_key, track, puzzle_id, game_id, completed_at, elapsed_seconds, mistakes, hints_used)
         VALUES (?, 'daily', ?, ?, ?, ?, ?, ?)`,
          dateKey,
          `dev-daily-${dateKey}`,
          `dev-daily-game-${dateKey}`,
          day.toISOString(),
          300 + i * 20,
          i % 2,
          0,
        );
      });
      // A few recent Daily Challenge (extreme) completions so the Challenge card
      // has data. No streak pressure on this track, so the dates can be sparse.
      const challengeInserts = Array.from({ length: SEED_CHALLENGE_DAYS }, (_, i) => {
        const day = new Date(now.getTime() - i * 2 * MS_PER_DAY);
        const dateKey = localDateKey(day);
        return txn.runAsync(
          `INSERT OR REPLACE INTO daily_progress
           (date_key, track, puzzle_id, game_id, completed_at, elapsed_seconds, mistakes, hints_used)
         VALUES (?, 'challenge', ?, ?, ?, ?, ?, ?)`,
          dateKey,
          `dev-challenge-${dateKey}`,
          `dev-challenge-game-${dateKey}`,
          day.toISOString(),
          1500 + i * 90,
          i % 3,
          i % 2,
        );
      });
      await Promise.all([...dailyProgressInserts, ...challengeInserts]);
    });
  });
}
