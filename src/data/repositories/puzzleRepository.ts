import type { Difficulty, Puzzle, PuzzleSource } from "@/domain/sudoku/types";

import { type DailyTrack, trackIdPrefix } from "@/domain/daily";

import { getDatabase, withWriteLock } from "../db/client";
import { BUNDLED_PACKS } from "../puzzleData";

type PuzzleRow = {
  id: string;
  difficulty: string;
  givens: string;
  solution: string;
  source: string;
  date_key: string | null;
};

function rowToPuzzle(row: PuzzleRow, dateKey?: string | null): Puzzle {
  return {
    id: row.id,
    difficulty: row.difficulty as Difficulty,
    givens: row.givens,
    solution: row.solution,
    source: row.source as PuzzleSource,
    dateKey: dateKey ?? row.date_key,
  };
}

/**
 * Import bundled puzzle packs into SQLite. A pack is (re)imported only when it
 * is missing or its version increased, so this is a cheap no-op on most
 * launches. Daily-pool puzzles are stored with a `daily_` id prefix to keep
 * them out of difficulty-based random selection.
 */
export async function importBundledPacksIfNeeded(): Promise<void> {
  const db = await getDatabase();

  for (const pack of BUNDLED_PACKS) {
    // eslint-disable-next-line no-await-in-loop -- pack version checks and imports intentionally run one at a time.
    const existing = await db.getFirstAsync<{ version: number }>(
      "SELECT version FROM puzzle_packs WHERE id = ?",
      pack.id,
    );
    if (existing && existing.version >= pack.version) {
      continue;
    }

    const now = new Date().toISOString();
    // eslint-disable-next-line no-await-in-loop -- each pack import owns an exclusive transaction.
    await withWriteLock(() =>
      db.withExclusiveTransactionAsync(async (txn) => {
        const statement = await txn.prepareAsync(
          `INSERT OR REPLACE INTO puzzles
             (id, difficulty, givens, solution, source, date_key, created_at)
           VALUES (?, ?, ?, ?, 'bundled', NULL, ?)`,
        );
        try {
          for (const puzzle of pack.puzzles) {
            // eslint-disable-next-line no-await-in-loop -- reuse the prepared statement sequentially.
            await statement.executeAsync([
              puzzle.id,
              puzzle.difficulty,
              puzzle.givens,
              puzzle.solution,
              now,
            ]);
          }
        } finally {
          await statement.finalizeAsync();
        }
        await txn.runAsync(
          "INSERT OR REPLACE INTO puzzle_packs (id, version, imported_at) VALUES (?, ?, ?)",
          pack.id,
          pack.version,
          now,
        );
      }),
    );
  }
}

export async function getPuzzleById(id: string): Promise<Puzzle | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<PuzzleRow>("SELECT * FROM puzzles WHERE id = ?", id);
  return row ? rowToPuzzle(row) : null;
}

/** A random difficulty-pool puzzle (never one from a daily/challenge pool). */
export async function getRandomPuzzleByDifficulty(difficulty: Difficulty): Promise<Puzzle | null> {
  const db = await getDatabase();
  const countRow = await db.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) AS count FROM puzzles
       WHERE difficulty = ? AND id NOT LIKE 'daily_%' AND id NOT LIKE 'challenge_%'`,
    difficulty,
  );
  const count = countRow?.count ?? 0;
  if (count === 0) {
    return null;
  }
  const offset = Math.floor(Math.random() * count);
  const row = await db.getFirstAsync<PuzzleRow>(
    `SELECT * FROM puzzles
       WHERE difficulty = ? AND id NOT LIKE 'daily_%' AND id NOT LIKE 'challenge_%'
       ORDER BY id LIMIT 1 OFFSET ?`,
    difficulty,
    offset,
  );
  return row ? rowToPuzzle(row) : null;
}

/** Number of puzzles in a daily track's rotating pool. */
export async function getDailyPoolCount(track: DailyTrack): Promise<number> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ count: number }>(
    "SELECT COUNT(*) AS count FROM puzzles WHERE id LIKE ?",
    `${trackIdPrefix(track)}%`,
  );
  return row?.count ?? 0;
}

/**
 * The puzzle at a stable index within a daily track's pool (ordered by id). The
 * caller derives the index from the calendar date; `dateKey` is attached to the
 * result for progress/streak tracking but does not affect selection.
 */
export async function getDailyPuzzleByIndex(
  track: DailyTrack,
  index: number,
  dateKey?: string | null,
): Promise<Puzzle | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<PuzzleRow>(
    "SELECT * FROM puzzles WHERE id LIKE ? ORDER BY id LIMIT 1 OFFSET ?",
    `${trackIdPrefix(track)}%`,
    index,
  );
  return row ? rowToPuzzle(row, dateKey) : null;
}
