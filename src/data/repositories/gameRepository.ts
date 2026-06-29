import * as Crypto from "expo-crypto";

import { parseValuesString, valuesToString } from "@/domain/sudoku/board";
import { CELL_COUNT, type GameState, type GameStatus, type Puzzle } from "@/domain/sudoku/types";

import { getDatabase } from "../db/client";
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
  started_at: string;
  completed_at: string | null;
  updated_at: string;
};

/**
 * Serializes writes that must not interleave on the single shared connection.
 * expo-sqlite runs statements on one queue, but a plain `runAsync` can still
 * slip *inside* an in-flight `withExclusiveTransactionAsync` (the exclusive lock
 * only blocks other transaction calls, not bare statements). A debounced
 * `saveGame` dispatched just before a win would otherwise overlap `completeGame`
 * and make its transaction throw, rolling back the status flip and leaving the
 * row active one move short of solved. Chaining every write here keeps them
 * strictly sequential, so completion always lands.
 */
let writeChain: Promise<unknown> = Promise.resolve();
function serializeWrite<T>(op: () => Promise<T>): Promise<T> {
  const run = writeChain.then(op, op);
  // Keep the chain alive even if a write rejects, but don't let its rejection
  // propagate to the next queued write.
  writeChain = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

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
    startedAt: now,
    completedAt: null,
    updatedAt: now,
  };
}

/** Create a game from a puzzle and persist it. */
export async function createGame(puzzle: Puzzle): Promise<GameState> {
  const game = newGameState(puzzle);
  await saveGame(game);
  return game;
}

/**
 * Insert or update a game row from current state, stamping updated_at. Saves are
 * debounced and fire-and-forget, so one dispatched just before a win can land
 * after completeGame; the ON CONFLICT guard refuses to overwrite a row that has
 * already reached a terminal state (completed/abandoned) with an in-progress
 * snapshot, so a late stale save can't resurrect a finished game. A genuinely
 * terminal save still wins.
 */
export async function saveGame(game: GameState): Promise<void> {
  await serializeWrite(async () => {
    const db = await getDatabase();
    await db.runAsync(
      `INSERT INTO games
         (id, puzzle_id, difficulty, givens, solution, values_string, notes_json,
          status, elapsed_seconds, mistakes, hints_used, started_at, completed_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
         started_at = excluded.started_at,
         completed_at = excluded.completed_at,
         updated_at = excluded.updated_at
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
      game.startedAt,
      game.completedAt,
      new Date().toISOString(),
    );
  });
}

export async function getGameById(id: string): Promise<GameState | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<GameRow>("SELECT * FROM games WHERE id = ?", id);
  return row ? rowToGame(row) : null;
}

/** The most recently updated resumable game (active or paused), if any. */
export async function getActiveGame(): Promise<GameState | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<GameRow>(
    `SELECT * FROM games
       WHERE status IN ('active', 'paused')
         AND id NOT IN (
           SELECT game_id FROM daily_progress WHERE game_id IS NOT NULL
         )
       ORDER BY updated_at DESC LIMIT 1`,
  );
  return row ? rowToGame(row) : null;
}

/**
 * Mark a game completed and record it in completed_games. Per the project's
 * lifecycle decision the games row is kept (status = 'completed'), so it no
 * longer surfaces as resumable but its history remains.
 */
export async function completeGame(game: GameState): Promise<GameState> {
  const completedAt = new Date().toISOString();
  const completed: GameState = { ...game, status: "completed", completedAt };

  await serializeWrite(async () => {
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
              elapsed_seconds = ?, mistakes = ?, hints_used = ?
        WHERE id = ?`,
        completedAt,
        completedAt,
        valuesToString(game.values),
        JSON.stringify(game.notes),
        game.elapsedSeconds,
        game.mistakes,
        game.hintsUsed,
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
 * Mark a resumable game abandoned so it no longer surfaces as the active game.
 * Nothing is written to completed_games, so stats are unaffected.
 */
export async function abandonGame(id: string): Promise<void> {
  await serializeWrite(async () => {
    const db = await getDatabase();
    await db.runAsync(
      "UPDATE games SET status = 'abandoned', updated_at = ? WHERE id = ? AND status IN ('active', 'paused')",
      new Date().toISOString(),
      id,
    );
  });
}
