import * as SQLite from "expo-sqlite";

import { runMigrations } from "./migrations";

export const DATABASE_NAME = "sudoku.db";

let databasePromise: Promise<SQLite.SQLiteDatabase> | null = null;

async function openAndPrepare(): Promise<SQLite.SQLiteDatabase> {
  const db = await SQLite.openDatabaseAsync(DATABASE_NAME);
  // WAL improves concurrent read/write performance; foreign keys enforce
  // referential integrity. These are connection-level and must be set per open.
  await db.execAsync("PRAGMA journal_mode = WAL;\nPRAGMA foreign_keys = ON;");
  await runMigrations(db);
  return db;
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
