import type { DailyTrack } from "@/domain/daily";

import * as Crypto from "expo-crypto";

import { parseValuesString, valuesToString } from "@/domain/sudoku/board";
import { CELL_COUNT, type GameState, type GameStatus, type Puzzle } from "@/domain/sudoku/types";

import { getDatabase, withWriteLock } from "../db/client";
import { completeDailyForGame } from "./dailyRepository";

type GameRow = {
  id: string;
  puzzle_id: string;
  difficulty: string;
  givens: string;
  solution: string;
  values_string: string;
  notes_json: string;
  status: string;
  elapsed_seconds: number;
  mistakes: number;
  hints_used: number;
  hinted_cells_json: string;
  started_at: string;
  completed_at: string | null;
  updated_at: string;
  shared_daily_track: string | null;
  shared_daily_date_key: string | null;
};

export type SharedDailyMeta = {
  track: DailyTrack;
  dateKey: string;
};

function rowToGame(row: GameRow): GameState {
  return {
    id: row.id,
    puzzleId: row.puzzle_id,
    difficulty: row.difficulty as GameState["difficulty"],
    givens: row.givens,
    solution: row.solution,
    values: parseValuesString(row.values_string),
    notes: JSON.parse(row.notes_json) as number[],
    status: row.status as GameStatus,
    elapsedSeconds: row.elapsed_seconds,
    mistakes: row.mistakes,
    hintsUsed: row.hints_used,
    hintedCells: JSON.parse(row.hinted_cells_json ?? "[]") as number[],
    startedAt: row.started_at,
    completedAt: row.completed_at,
    updatedAt: row.updated_at,
  };
}

/** Build a fresh game from a puzzle (not yet persisted). */
export function newGameState(puzzle: Puzzle): GameState {
  const now = new Date().toISOString();
  return {
    id: Crypto.randomUUID(),
    puzzleId: puzzle.id,
    difficulty: puzzle.difficulty,
    givens: puzzle.givens,
    solution: puzzle.solution,
    values: parseValuesString(puzzle.givens),
    notes: Array.from({ length: CELL_COUNT }, () => 0),
    status: "active",
    elapsedSeconds: 0,
    mistakes: 0,
    hintsUsed: 0,
    hintedCells: [],
    startedAt: now,
    completedAt: null,
    updatedAt: now,
  };
}

/** Create a game from a puzzle and persist it. */
export async function createGame(
  puzzle: Puzzle,
  sharedDaily?: SharedDailyMeta | null,
): Promise<GameState> {
  const game = newGameState(puzzle);
  await saveGame(game, sharedDaily ?? null);
  return game;
}

/** Shared-link daily metadata stored on a one-off game (no daily_progress row). */
export async function getSharedDailyForGame(gameId: string): Promise<SharedDailyMeta | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{
    shared_daily_track: string | null;
    shared_daily_date_key: string | null;
  }>("SELECT shared_daily_track, shared_daily_date_key FROM games WHERE id = ?", gameId);
  if (!row?.shared_daily_track || !row.shared_daily_date_key) {
    return null;
  }
  return {
    track: row.shared_daily_track as DailyTrack,
    dateKey: row.shared_daily_date_key,
  };
}

/**
 * Insert or update a game row from current state, stamping updated_at. Saves are
 * debounced and fire-and-forget, so one dispatched just before a win can land
 * after completeGame; the ON CONFLICT guard refuses to overwrite a row that has
 * already reached a terminal state (completed/abandoned) with an in-progress
 * snapshot, so a late stale save can't resurrect a finished game. A genuinely
 * terminal save still wins.
 */
export async function saveGame(
  game: GameState,
  sharedDaily?: SharedDailyMeta | null,
): Promise<void> {
  await withWriteLock(async () => {
    const db = await getDatabase();
    await db.runAsync(
      `INSERT INTO games
         (id, puzzle_id, difficulty, givens, solution, values_string, notes_json,
          status, elapsed_seconds, mistakes, hints_used, hinted_cells_json,
          started_at, completed_at, updated_at,
          shared_daily_track, shared_daily_date_key)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         puzzle_id = excluded.puzzle_id,
         difficulty = excluded.difficulty,
         givens = excluded.givens,
         solution = excluded.solution,
         values_string = excluded.values_string,
         notes_json = excluded.notes_json,
         status = excluded.status,
         elapsed_seconds = excluded.elapsed_seconds,
         mistakes = excluded.mistakes,
         hints_used = excluded.hints_used,
         hinted_cells_json = excluded.hinted_cells_json,
         started_at = excluded.started_at,
         completed_at = excluded.completed_at,
         updated_at = excluded.updated_at,
         shared_daily_track = COALESCE(games.shared_daily_track, excluded.shared_daily_track),
         shared_daily_date_key = COALESCE(games.shared_daily_date_key, excluded.shared_daily_date_key)
       WHERE games.status NOT IN ('completed', 'abandoned')
          OR excluded.status IN ('completed', 'abandoned')`,
      game.id,
      game.puzzleId,
      game.difficulty,
      game.givens,
      game.solution,
      valuesToString(game.values),
      JSON.stringify(game.notes),
      game.status,
      game.elapsedSeconds,
      game.mistakes,
      game.hintsUsed,
      JSON.stringify(game.hintedCells),
      game.startedAt,
      game.completedAt,
      new Date().toISOString(),
      sharedDaily?.track ?? null,
      sharedDaily?.dateKey ?? null,
    );
  });
}

export async function getGameById(id: string): Promise<GameState | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<GameRow>("SELECT * FROM games WHERE id = ?", id);
  return row ? rowToGame(row) : null;
}

/**
 * The most recently updated resumable game (active or paused) for each
 * difficulty, so Home can offer a per-difficulty continue. Daily-track games
 * are excluded (they resume via the daily cards), as are shared-link one-offs
 * (they carry someone else's target and reopen via their link). Where history
 * left several resumable games of one difficulty, only the newest surfaces.
 */
export async function getResumableGamesByDifficulty(): Promise<
  Partial<Record<GameState["difficulty"], GameState>>
> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<GameRow>(
    `SELECT * FROM games
       WHERE status IN ('active', 'paused')
         AND shared_daily_track IS NULL
         AND id NOT IN (
           SELECT game_id FROM daily_progress WHERE game_id IS NOT NULL
         )
       ORDER BY updated_at DESC`,
  );
  const byDifficulty: Partial<Record<GameState["difficulty"], GameState>> = {};
  for (const row of rows) {
    const game = rowToGame(row);
    byDifficulty[game.difficulty] ??= game;
  }
  return byDifficulty;
}

/**
 * Mark a game completed and record it in completed_games. Per the project's
 * lifecycle decision the games row is kept (status = 'completed'), so it no
 * longer surfaces as resumable but its history remains.
 */
export async function completeGame(game: GameState): Promise<GameState> {
  const completedAt = new Date().toISOString();
  const completed: GameState = { ...game, status: "completed", completedAt };

  await withWriteLock(async () => {
    const db = await getDatabase();
    await db.withExclusiveTransactionAsync(async (txn) => {
      // Persist the final board and run stats alongside the status flip. The
      // completing placement cancels the debounced saveGame (see the game store),
      // so this UPDATE is the only thing that records the last move — writing just
      // the status would leave the row's board frozen one move short of solved.
      await txn.runAsync(
        `UPDATE games
          SET status = 'completed', completed_at = ?, updated_at = ?,
              values_string = ?, notes_json = ?,
              elapsed_seconds = ?, mistakes = ?, hints_used = ?, hinted_cells_json = ?
        WHERE id = ?`,
        completedAt,
        completedAt,
        valuesToString(game.values),
        JSON.stringify(game.notes),
        game.elapsedSeconds,
        game.mistakes,
        game.hintsUsed,
        JSON.stringify(game.hintedCells),
        game.id,
      );
      // If this game is the tracked daily, mark its progress complete and carry
      // the date_key onto the completed_games row (NULL for ordinary games).
      const dateKey = await completeDailyForGame(txn, game.id, {
        completedAt,
        elapsedSeconds: game.elapsedSeconds,
        mistakes: game.mistakes,
        hintsUsed: game.hintsUsed,
      });
      await txn.runAsync(
        `INSERT OR REPLACE INTO completed_games
         (id, game_id, puzzle_id, difficulty, date_key, elapsed_seconds, mistakes, hints_used, completed_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        Crypto.randomUUID(),
        game.id,
        game.puzzleId,
        game.difficulty,
        dateKey,
        game.elapsedSeconds,
        game.mistakes,
        game.hintsUsed,
        completedAt,
      );
    });
  });

  return completed;
}

/**
 * Self-heal completions that a lost write left stuck in-progress: a games row
 * whose board already equals its solution but is still 'active'/'paused' (the
 * player finished it, but the completion transaction never committed — see
 * `withWriteLock` in db/client). Replaying completeGame restores the completed
 * status, the completed_games row, and — for a daily — the daily_progress stamp
 * that drives the streak. The status flip makes this self-limiting: a reconciled
 * game is no longer a candidate next boot, so it can't double-record. Returns
 * how many games were healed. Runs once at boot (see data/init).
 */
export async function reconcileStuckCompletions(): Promise<number> {
  const db = await getDatabase();
  // A solved board serializes to exactly the solution string (digits, no zeros),
  // so this equality is the same condition as isPuzzleComplete.
  const rows = await db.getAllAsync<GameRow>(
    `SELECT * FROM games
       WHERE status IN ('active', 'paused')
         AND values_string = solution`,
  );
  for (const row of rows) {
    // completeGame serializes through the write lock anyway, so sequential here
    // keeps the per-game daily-stamp logic simple.
    // eslint-disable-next-line no-await-in-loop
    await completeGame(rowToGame(row));
  }
  return rows.length;
}

/**
 * Mark a resumable game abandoned so it no longer surfaces as the active game.
 * Nothing is written to completed_games, so stats are unaffected.
 */
export async function abandonGame(id: string): Promise<void> {
  await withWriteLock(async () => {
    const db = await getDatabase();
    await db.runAsync(
      "UPDATE games SET status = 'abandoned', updated_at = ? WHERE id = ? AND status IN ('active', 'paused')",
      new Date().toISOString(),
      id,
    );
  });
}
