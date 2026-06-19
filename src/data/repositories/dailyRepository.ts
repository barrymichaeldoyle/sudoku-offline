import type { DailyTrack } from "@/domain/daily";
import type { SQLiteDatabase } from "expo-sqlite";

import { getDatabase } from "../db/client";

/** The subset of the SQLite API we need inside an existing transaction. */
type SQLiteRunner = Pick<SQLiteDatabase, "getFirstAsync" | "runAsync">;

export type DailyProgress = {
  dateKey: string;
  track: DailyTrack;
  puzzleId: string;
  gameId: string | null;
  completedAt: string | null;
  elapsedSeconds: number | null;
  mistakes: number | null;
  hintsUsed: number | null;
};

type DailyRow = {
  date_key: string;
  track: string;
  puzzle_id: string;
  game_id: string | null;
  completed_at: string | null;
  elapsed_seconds: number | null;
  mistakes: number | null;
  hints_used: number | null;
};

function rowToProgress(row: DailyRow): DailyProgress {
  return {
    dateKey: row.date_key,
    track: row.track as DailyTrack,
    puzzleId: row.puzzle_id,
    gameId: row.game_id,
    completedAt: row.completed_at,
    elapsedSeconds: row.elapsed_seconds,
    mistakes: row.mistakes,
    hintsUsed: row.hints_used,
  };
}

export async function getDailyProgress(
  dateKey: string,
  track: DailyTrack = "daily",
): Promise<DailyProgress | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<DailyRow>(
    "SELECT * FROM daily_progress WHERE date_key = ? AND track = ?",
    dateKey,
    track,
  );
  return row ? rowToProgress(row) : null;
}

/**
 * Record that a daily puzzle (for `track`) was started for `dateKey`, attaching
 * the game that is tracking it. If that day+track already has a completed entry
 * it is left untouched so replays never clobber the recorded result (or streak).
 */
export async function startDailyProgress(
  dateKey: string,
  track: DailyTrack,
  puzzleId: string,
  gameId: string,
): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `INSERT INTO daily_progress (date_key, track, puzzle_id, game_id)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(date_key, track) DO UPDATE SET
       puzzle_id = excluded.puzzle_id,
       game_id = excluded.game_id
     WHERE daily_progress.completed_at IS NULL`,
    dateKey,
    track,
    puzzleId,
    gameId,
  );
}

/**
 * If `gameId` is the game tracking an as-yet-uncompleted daily, stamp the
 * `daily_progress` row as completed with the run's result and return its
 * `date_key`. Returns null for non-daily games (or a daily already recorded, so
 * replays never clobber the first result). Runs inside the caller's transaction
 * so it stays atomic with the games/completed_games writes.
 */
export async function completeDailyForGame(
  runner: SQLiteRunner,
  gameId: string,
  result: {
    completedAt: string;
    elapsedSeconds: number;
    mistakes: number;
    hintsUsed: number;
  },
): Promise<string | null> {
  const row = await runner.getFirstAsync<{ date_key: string }>(
    "SELECT date_key FROM daily_progress WHERE game_id = ? AND completed_at IS NULL",
    gameId,
  );
  if (!row) {
    return null;
  }
  await runner.runAsync(
    `UPDATE daily_progress
        SET completed_at = ?, elapsed_seconds = ?, mistakes = ?, hints_used = ?
      WHERE game_id = ?`,
    result.completedAt,
    result.elapsedSeconds,
    result.mistakes,
    result.hintsUsed,
    gameId,
  );
  return row.date_key;
}

/** Which daily track (and date) a game belongs to, if any — for the completion screen. */
export async function getDailyForGame(
  gameId: string,
): Promise<{ dateKey: string; track: DailyTrack } | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ date_key: string; track: string }>(
    "SELECT date_key, track FROM daily_progress WHERE game_id = ?",
    gameId,
  );
  return row ? { dateKey: row.date_key, track: row.track as DailyTrack } : null;
}

/**
 * Date keys (sorted) on which a daily track was completed. Defaults to the
 * normal "daily" track, which is what drives the streak.
 */
export async function getCompletedDailyDateKeys(track: DailyTrack = "daily"): Promise<string[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{ date_key: string }>(
    "SELECT date_key FROM daily_progress WHERE completed_at IS NOT NULL AND track = ? ORDER BY date_key",
    track,
  );
  return rows.map((r) => r.date_key);
}
