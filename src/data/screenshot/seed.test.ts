// Mock the data-layer side effects so importing the seed module doesn't pull in
// the SQLite client; these tests only exercise the pure board builder.
jest.mock("@/data/repositories/gameRepository", () => ({ saveGame: jest.fn() }));
jest.mock("@/data/repositories/statsRepository", () => ({ seedSampleStats: jest.fn() }));

import { hasDuplicate, isGivenCell } from "@/domain/sudoku/board";
import { CELL_COUNT } from "@/domain/sudoku/types";

import { buildScreenshotGame, SCREENSHOT_SELECTED_CELL } from "./seed";

describe("buildScreenshotGame", () => {
  const game = buildScreenshotGame();

  it("produces a full 81-cell board", () => {
    expect(game.givens).toHaveLength(CELL_COUNT);
    expect(game.solution).toHaveLength(CELL_COUNT);
    expect(game.values).toHaveLength(CELL_COUNT);
    expect(game.notes).toHaveLength(CELL_COUNT);
  });

  it("has a valid solution with no peer duplicates", () => {
    const solved = game.solution.split("").map(Number);
    for (let i = 0; i < CELL_COUNT; i++) {
      expect(hasDuplicate(solved, i)).toBe(false);
    }
  });

  it("never conflicts: filled cells match the solution and clash with no peer", () => {
    for (let i = 0; i < CELL_COUNT; i++) {
      const v = game.values[i];
      if (v != null) {
        expect(String(v)).toBe(game.solution[i]);
        expect(hasDuplicate(game.values, i)).toBe(false);
      }
    }
  });

  it("keeps every given filled and correct", () => {
    for (let i = 0; i < CELL_COUNT; i++) {
      if (isGivenCell(game.givens, i)) {
        expect(game.givens[i]).toBe(game.solution[i]);
        expect(game.values[i]).toBe(Number(game.solution[i]));
      }
    }
  });

  it("is a resumable, mid-progress game with blanks left", () => {
    expect(game.status).toBe("active");
    const empty = game.values.filter((v) => v == null).length;
    expect(empty).toBeGreaterThan(0);
  });

  it("fills the pre-selected center cell as a non-given entry", () => {
    // The capture script selects this cell; it must be a non-given the player
    // has filled, so selection highlighting renders against a user entry.
    expect(isGivenCell(game.givens, SCREENSHOT_SELECTED_CELL)).toBe(false);
    expect(game.values[SCREENSHOT_SELECTED_CELL]).not.toBeNull();
  });
});
