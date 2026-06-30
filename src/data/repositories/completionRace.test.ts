// Reproduces the real-world completion race and proves the shared write lock
// fixes it. On a win the game store fires TWO writes near-simultaneously:
//   1. completeGame()  -> db.withExclusiveTransactionAsync(...)  (own connection)
//   2. track(...)      -> enqueueEvent() -> db.runAsync(...)     (main connection)
// expo-sqlite's exclusive transaction holds a write lock on a second connection;
// a bare runAsync that overlaps it aborts with "database is locked", rolling back
// the completion (home then shows ~98% and the daily/streak stamp is lost).
//
// We model that lock conflict with a fake db, then show: raw concurrent calls
// reject (the bug), but the real wrapped repository functions never do (the fix).

jest.mock("../db/client", () => {
  const actual = jest.requireActual("../db/client");
  return { ...actual, getDatabase: jest.fn() };
});

import { CELL_COUNT, type GameState } from "@/domain/sudoku/types";

import { getDatabase } from "../db/client";
import { enqueueEvent } from "./eventRepository";
import { completeGame } from "./gameRepository";

const mockGetDatabase = getDatabase as jest.Mock;
const tick = () => new Promise<void>((resolve) => setImmediate(resolve));

/**
 * A fake SQLite db that models the cross-connection write-lock conflict:
 * while the exclusive transaction holds the lock, any bare runAsync aborts with
 * "database is locked", and vice versa. Every op yields to the event loop so
 * concurrent callers genuinely interleave.
 */
function makeLockingDb() {
  const state = { exclusiveHeld: false, bareInFlight: false };
  const executed: string[] = [];

  const runAsync = async (sql: string) => {
    if (state.exclusiveHeld) throw new Error("database is locked");
    state.bareInFlight = true;
    await tick();
    if (state.exclusiveHeld) {
      state.bareInFlight = false;
      throw new Error("database is locked");
    }
    state.bareInFlight = false;
    executed.push(sql);
  };

  const withExclusiveTransactionAsync = async (
    cb: (txn: {
      runAsync: (sql: string) => Promise<void>;
      getFirstAsync: () => Promise<null>;
    }) => Promise<void>,
  ) => {
    if (state.bareInFlight) throw new Error("database is locked");
    state.exclusiveHeld = true;
    try {
      await tick();
      if (state.bareInFlight) throw new Error("database is locked");
      await cb({
        runAsync: async (sql: string) => {
          if (state.bareInFlight) throw new Error("database is locked");
          executed.push(sql);
          await tick();
        },
        getFirstAsync: async () => null,
      });
    } finally {
      state.exclusiveHeld = false;
    }
  };

  return { runAsync, withExclusiveTransactionAsync, executed, state };
}

function completedGame(): GameState {
  const now = new Date().toISOString();
  const solution = "1".repeat(CELL_COUNT);
  return {
    id: "game-1",
    puzzleId: "puzzle-1",
    difficulty: "easy",
    givens: ".".repeat(CELL_COUNT),
    solution,
    values: Array.from({ length: CELL_COUNT }, () => 1),
    notes: Array.from({ length: CELL_COUNT }, () => 0),
    status: "active",
    elapsedSeconds: 100,
    mistakes: 0,
    hintsUsed: 0,
    startedAt: now,
    completedAt: null,
    updatedAt: now,
  };
}

describe("completion race against a concurrent analytics write", () => {
  it("the fake db reproduces the bug: raw concurrent writes abort with 'database is locked'", async () => {
    const db = makeLockingDb();
    // Fire both writes concurrently WITHOUT the shared lock, as the old code did.
    const results = await Promise.allSettled([
      db.withExclusiveTransactionAsync(async (txn) => {
        await txn.runAsync("UPDATE games ...");
      }),
      db.runAsync("INSERT INTO pending_events ..."),
    ]);
    const rejected = results.filter((r) => r.status === "rejected");
    expect(rejected.length).toBeGreaterThan(0);
    expect((rejected[0] as PromiseRejectedResult).reason.message).toContain("database is locked");
  });

  it("the real completeGame + enqueueEvent never collide (fix)", async () => {
    const db = makeLockingDb();
    mockGetDatabase.mockResolvedValue(db);

    // Exactly what the store does on a win: dispatch both at once.
    const completing = completeGame(completedGame());
    const tracking = enqueueEvent("puzzle_completed", JSON.stringify({ difficulty: "easy" }));

    await expect(Promise.all([completing, tracking])).resolves.toBeDefined();

    // The completion transaction's writes landed...
    expect(db.executed.some((s) => s.includes("UPDATE games"))).toBe(true);
    expect(db.executed.some((s) => s.includes("INSERT OR REPLACE INTO completed_games"))).toBe(
      true,
    );
    // ...and so did the analytics write, with no rollback.
    expect(db.executed.some((s) => s.includes("INSERT INTO pending_events"))).toBe(true);
  });

  it("stays correct when the analytics write is dispatched first", async () => {
    const db = makeLockingDb();
    mockGetDatabase.mockResolvedValue(db);

    // Reverse the dispatch order to cover the other interleaving.
    const tracking = enqueueEvent("puzzle_completed", "{}");
    const completing = completeGame(completedGame());

    await expect(Promise.all([tracking, completing])).resolves.toBeDefined();
    expect(db.executed.some((s) => s.includes("UPDATE games"))).toBe(true);
  });
});
