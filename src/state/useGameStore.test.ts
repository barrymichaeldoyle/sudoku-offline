import type { GameState } from "@/domain/sudoku/types";

// Isolate the reducer logic from IO: no SQLite, haptics, or analytics.
jest.mock("@/services/haptics", () => ({
  haptics: { place: jest.fn(), invalid: jest.fn(), complete: jest.fn(), toggle: jest.fn() },
}));
jest.mock("@/services/analyticsService", () => ({ track: jest.fn() }));
jest.mock("@/data/repositories/gameRepository", () => ({
  saveGame: jest.fn().mockResolvedValue(undefined),
  completeGame: jest.fn().mockResolvedValue(undefined),
  getGameById: jest.fn().mockResolvedValue(null),
}));

import { useGameStore } from "./useGameStore";

// A valid completed grid; givens are all empty so every cell is editable.
const SOLUTION =
  "534678912672195348198342567859761423426853791713924856961537284287419635345286179";
const GIVENS = "0".repeat(81);

function freshGame(): GameState {
  return {
    id: "test-game",
    puzzleId: "p1",
    difficulty: "easy",
    givens: GIVENS,
    solution: SOLUTION,
    values: Array.from({ length: 81 }, () => null),
    notes: Array.from({ length: 81 }, () => 0),
    status: "active",
    elapsedSeconds: 0,
    mistakes: 0,
    hintsUsed: 0,
    startedAt: "2026-06-19T00:00:00.000Z",
    completedAt: null,
    updatedAt: "2026-06-19T00:00:00.000Z",
  };
}

function load(): void {
  useGameStore.getState().setGame(freshGame());
}

describe("useGameStore reducers", () => {
  beforeEach(() => {
    load();
    useGameStore.getState().setInputMode("cell");
  });

  it("places a value into the selected cell (cell-first)", () => {
    const s = useGameStore.getState();
    s.pressCell(0);
    s.pressNumber(5); // SOLUTION[0] === 5
    const game = useGameStore.getState().game!;
    expect(game.values[0]).toBe(5);
    expect(game.mistakes).toBe(0);
  });

  it("clears the value when the same number is tapped again", () => {
    const s = useGameStore.getState();
    s.pressCell(0);
    s.pressNumber(5);
    s.pressNumber(5);
    expect(useGameStore.getState().game!.values[0]).toBeNull();
  });

  it("increments mistakes when the placed value disagrees with the solution", () => {
    const s = useGameStore.getState();
    s.pressCell(0);
    s.pressNumber(3); // wrong: SOLUTION[0] === 5
    const game = useGameStore.getState().game!;
    expect(game.values[0]).toBe(3);
    expect(game.mistakes).toBe(1);
  });

  it("toggles a pencil note in notes mode without setting a value", () => {
    const s = useGameStore.getState();
    s.toggleNotesMode();
    s.pressCell(0);
    s.pressNumber(7);
    const game = useGameStore.getState().game!;
    expect(game.values[0]).toBeNull();
    expect(game.notes[0]).toBe(1 << 6); // note 7 -> bit 6
  });

  it("erases a cell and undo restores it", () => {
    const s = useGameStore.getState();
    s.pressCell(0);
    s.pressNumber(5);
    s.erase();
    expect(useGameStore.getState().game!.values[0]).toBeNull();
    useGameStore.getState().undo();
    expect(useGameStore.getState().game!.values[0]).toBe(5);
  });

  it("undo reverses the last placement", () => {
    const s = useGameStore.getState();
    s.pressCell(0);
    s.pressNumber(5);
    s.undo();
    expect(useGameStore.getState().game!.values[0]).toBeNull();
    expect(useGameStore.getState().undoStack).toHaveLength(0);
  });
});
