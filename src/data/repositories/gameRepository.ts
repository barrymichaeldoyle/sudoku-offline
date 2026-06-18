import * as Crypto from "expo-crypto";

import { parseValuesString, valuesToString } from "@/domain/sudoku/board";
import { CELL_COUNT, type GameState, type GameStatus, type Puzzle } from "@/domain/sudoku/types";

import { getDatabase } from "../db/client";

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

/** Insert or update a game row from current state, stamping updated_at. */
export async function saveGame(game: GameState): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `INSERT OR REPLACE INTO games
       (id, puzzle_id, difficulty, givens, solution, values_string, notes_json,
        status, elapsed_seconds, mistakes, hints_used, started_at, completed_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
  const db = await getDatabase();
  const completedAt = new Date().toISOString();
  const completed: GameState = { ...game, status: "completed", completedAt };

  await db.withExclusiveTransactionAsync(async (txn) => {
    await txn.runAsync(
      "UPDATE games SET status = 'completed', completed_at = ?, updated_at = ? WHERE id = ?",
      completedAt,
      completedAt,
      game.id,
    );
    await txn.runAsync(
      `INSERT OR REPLACE INTO completed_games
         (id, game_id, puzzle_id, difficulty, date_key, elapsed_seconds, mistakes, hints_used, completed_at)
       VALUES (?, ?, ?, ?, NULL, ?, ?, ?, ?)`,
      Crypto.randomUUID(),
      game.id,
      game.puzzleId,
      game.difficulty,
      game.elapsedSeconds,
      game.mistakes,
      game.hintsUsed,
      completedAt,
    );
  });

  return completed;
}
