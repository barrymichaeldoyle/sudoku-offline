import type { SQLiteDatabase } from "expo-sqlite";

import { MIGRATIONS } from "./schema";

export async function getSchemaVersion(db: SQLiteDatabase): Promise<number> {
  const row = await db.getFirstAsync<{ user_version: number }>("PRAGMA user_version");
  return row?.user_version ?? 0;
}

/**
 * Apply any migrations newer than the database's current user_version. Each
 * migration's DDL and the version bump run in one exclusive transaction, so an
 * interrupted migration rolls back cleanly and is retried on next launch.
 */
export async function runMigrations(db: SQLiteDatabase): Promise<void> {
  let current = await getSchemaVersion(db);

  for (const migration of MIGRATIONS) {
    if (migration.version <= current) {
      continue;
    }
    await db.withExclusiveTransactionAsync(async (txn) => {
      await txn.execAsync(migration.up);
      // PRAGMA user_version writes are transactional in SQLite.
      await txn.execAsync(`PRAGMA user_version = ${migration.version}`);
    });
    current = migration.version;
  }
}
