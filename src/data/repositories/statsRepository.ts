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
