jest.mock("../db/client", () => ({
  getDatabase: jest.fn(),
}));

jest.mock("./dailyRepository", () => ({
  completeDailyForGame: jest.fn().mockResolvedValue(null),
}));

import { CELL_COUNT, type GameState } from "@/domain/sudoku/types";

import { getDatabase } from "../db/client";
import { completeGame, getActiveGame, saveGame } from "./gameRepository";

const mockGetDatabase = getDatabase as jest.Mock;

function freshGame(): GameState {
  const now = new Date().toISOString();
  return {
    id: "game-1",
    puzzleId: "puzzle-1",
    difficulty: "easy",
    givens: ".".repeat(CELL_COUNT),
    solution: "1".repeat(CELL_COUNT),
    values: Array.from({ length: CELL_COUNT }, () => null),
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

describe("gameRepository", () => {
  beforeEach(() => {
    mockGetDatabase.mockReset();
  });

  it("excludes daily and challenge games from the generic active game", async () => {
    const getFirstAsync = jest.fn().mockResolvedValue(null);
    mockGetDatabase.mockResolvedValue({ getFirstAsync });

    await expect(getActiveGame()).resolves.toBeNull();

    expect(getFirstAsync).toHaveBeenCalledWith(expect.stringContaining("id NOT IN"));
    expect(getFirstAsync).toHaveBeenCalledWith(
      expect.stringContaining("SELECT game_id FROM daily_progress"),
    );
  });

  it("persists the final board and stats when completing, not just the status", async () => {
    const runAsync = jest.fn().mockResolvedValue(undefined);
    const withExclusiveTransactionAsync = jest.fn(
      async (cb: (txn: { runAsync: jest.Mock; getFirstAsync: jest.Mock }) => Promise<void>) => {
        await cb({ runAsync, getFirstAsync: jest.fn().mockResolvedValue(null) });
      },
    );
    mockGetDatabase.mockResolvedValue({ withExclusiveTransactionAsync });

    const game = { ...freshGame(), elapsedSeconds: 321, mistakes: 2, hintsUsed: 1 };
    game.values[80] = 9; // the move that completes the board

    await completeGame(game);

    // The games UPDATE must carry the board + run stats, otherwise the row
    // freezes one move short of solved (the completing placement is never saved
    // because the store cancels the debounced save on a win).
    const gamesUpdate = runAsync.mock.calls.find(
      (c) => typeof c[0] === "string" && c[0].includes("UPDATE games"),
    );
    expect(gamesUpdate?.[0]).toContain("values_string = ?");
    expect(gamesUpdate?.[0]).toContain("notes_json = ?");
    expect(gamesUpdate?.[0]).toContain("elapsed_seconds = ?");
  });

  it("serializes a concurrent saveGame so it can't interleave with the completion transaction", async () => {
    // completeGame uses withExclusiveTransactionAsync; a plain saveGame runAsync
    // dispatched at the same time must not run *during* that transaction, or it
    // can make the exclusive transaction throw and the win is lost. The write
    // chain must hold the save until completion has fully resolved.
    const events: string[] = [];
    let releaseTxn: () => void = () => {};
    let signalBegan: () => void = () => {};
    const began = new Promise<void>((resolve) => {
      signalBegan = resolve;
    });

    const saveRunAsync = jest.fn(async () => {
      events.push("save");
    });
    const withExclusiveTransactionAsync = jest.fn(
      async (cb: (txn: { runAsync: jest.Mock; getFirstAsync: jest.Mock }) => Promise<void>) => {
        events.push("txn:begin");
        signalBegan();
        await new Promise<void>((resolve) => {
          releaseTxn = resolve;
        });
        await cb({
          runAsync: jest.fn().mockResolvedValue(undefined),
          getFirstAsync: jest.fn().mockResolvedValue(null),
        });
        events.push("txn:commit");
      },
    );
    mockGetDatabase.mockResolvedValue({ runAsync: saveRunAsync, withExclusiveTransactionAsync });

    const completing = completeGame(freshGame());
    // Dispatch the stale save while the completion transaction is "in flight".
    const saving = saveGame(freshGame());

    // Let the completion transaction reach its blocking point.
    await began;
    // The save must not have touched the db until the transaction finishes.
    expect(saveRunAsync).not.toHaveBeenCalled();

    releaseTxn();
    await Promise.all([completing, saving]);

    expect(events).toEqual(["txn:begin", "txn:commit", "save"]);
  });

  it("guards saveGame so a late stale write can't downgrade a finished game", async () => {
    const runAsync = jest.fn().mockResolvedValue(undefined);
    mockGetDatabase.mockResolvedValue({ runAsync });

    await saveGame(freshGame());

    const sql = runAsync.mock.calls[0]?.[0] as string;
    expect(sql).toContain("ON CONFLICT(id) DO UPDATE");
    expect(sql).toContain("games.status NOT IN ('completed', 'abandoned')");
    expect(sql).toContain("excluded.status IN ('completed', 'abandoned')");
  });
});
