import * as SQLite from "expo-sqlite";

import { runMigrations } from "./migrations";

export const DATABASE_NAME = "sudoku.db";

let databasePromise: Promise<SQLite.SQLiteDatabase> | null = null;

async function openAndPrepare(): Promise<SQLite.SQLiteDatabase> {
  const db = await SQLite.openDatabaseAsync(DATABASE_NAME);
  // WAL improves concurrent read/write performance; foreign keys enforce
  // referential integrity. busy_timeout makes a writer that finds the database
  // momentarily locked wait and retry for up to 5s instead of failing instantly
  // with SQLITE_BUSY — a safety net beneath the app-level write lock below.
  // These are connection-level and must be set per open.
  await db.execAsync(
    "PRAGMA journal_mode = WAL;\nPRAGMA busy_timeout = 5000;\nPRAGMA foreign_keys = ON;",
  );
  await runMigrations(db);
  return db;
}

/**
 * App-level write lock. Serializes every mutating statement (and every
 * transaction) against all other writes on the shared connection.
 *
 * `withExclusiveTransactionAsync` opens a SECOND connection and holds a write
 * lock for the whole transaction; any bare `runAsync` write that overlaps it on
 * the main connection makes one side abort with "database is locked" (per the
 * expo-sqlite docs). That race intermittently rolled back game completion — the
 * win showed on screen but home still read the row as active (e.g. 98%) — and
 * for daily puzzles dropped the streak, because the completion transaction's
 * daily_progress stamp never landed. Routing every write through this single
 * chain keeps writes strictly sequential so they can never collide.
 *
 * Reads are deliberately NOT chained: WAL lets them run concurrently with the
 * writer, and blocking them behind writes would needlessly slow the UI.
 */
let writeChain: Promise<unknown> = Promise.resolve();
export function withWriteLock<T>(op: () => Promise<T>): Promise<T> {
  const run = writeChain.then(op, op);
  // Keep the chain alive even if a write rejects, but don't let its rejection
  // propagate into the next queued write.
  writeChain = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

/**
 * Returns the shared database connection, opening it (and running migrations)
 * exactly once. Safe to call from anywhere; concurrent callers share the same
 * in-flight promise.
 */
export function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (!databasePromise) {
    databasePromise = openAndPrepare().catch((err) => {
      // Reset so a later call can retry instead of caching a rejected promise.
      databasePromise = null;
      throw err;
    });
  }
  return databasePromise;
}

/** Close the shared connection (mainly for tests and "reset" flows). */
export async function closeDatabase(): Promise<void> {
  if (!databasePromise) {
    return;
  }
  const db = await databasePromise;
  await db.closeAsync();
  databasePromise = null;
}
