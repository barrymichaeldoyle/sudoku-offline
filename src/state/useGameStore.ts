import type { GameState } from "@/domain/sudoku/types";

import { create } from "zustand";

import { completeGame, getGameById, saveGame } from "@/data/repositories/gameRepository";
import { isGivenCell, isPuzzleComplete, isValueCorrect } from "@/domain/sudoku/board";
import { cleanupNotesAfterPlacement, toggleNote } from "@/domain/sudoku/notes";

export type InputMode = "cell" | "number";

type GameStore = {
  game: GameState | null;
  loading: boolean;
  selectedCell: number | null;
  selectedNumber: number | null;
  inputMode: InputMode;
  notesMode: boolean;
  justCompleted: boolean;

  loadGame: (id: string) => Promise<void>;
  setGame: (game: GameState) => void;
  reset: () => void;

  setInputMode: (mode: InputMode) => void;
  toggleNotesMode: () => void;

  pressCell: (index: number) => void;
  pressNumber: (num: number) => void;
  erase: () => void;
};

function persist(game: GameState): void {
  // Fire-and-forget; gameplay never blocks on the write. Failures are
  // swallowed here — durability is best-effort per action for the MVP.
  void saveGame(game).catch(() => {});
}

export const useGameStore = create<GameStore>((set, get) => ({
  game: null,
  loading: false,
  selectedCell: null,
  selectedNumber: null,
  inputMode: "cell",
  notesMode: false,
  justCompleted: false,

  async loadGame(id) {
    const current = get().game;
    if (current?.id === id) {
      return;
    }
    set({ loading: true });
    const game = await getGameById(id);
    set({
      game,
      loading: false,
      selectedCell: null,
      selectedNumber: null,
      notesMode: false,
      justCompleted: false,
    });
  },

  setGame(game) {
    set({
      game,
      selectedCell: null,
      selectedNumber: null,
      notesMode: false,
      justCompleted: false,
    });
  },

  reset() {
    set({ game: null, selectedCell: null, selectedNumber: null, justCompleted: false });
  },

  setInputMode(mode) {
    set({ inputMode: mode, selectedCell: null, selectedNumber: null });
  },

  toggleNotesMode() {
    set((state) => ({ notesMode: !state.notesMode }));
  },

  pressCell(index) {
    const { inputMode, selectedNumber } = get();
    if (inputMode === "number" && selectedNumber != null) {
      applyNumber(set, get, index, selectedNumber);
      return;
    }
    set({ selectedCell: index });
  },

  pressNumber(num) {
    const { inputMode, selectedCell } = get();
    if (inputMode === "number") {
      set((state) => ({ selectedNumber: state.selectedNumber === num ? null : num }));
      return;
    }
    if (selectedCell != null) {
      applyNumber(set, get, selectedCell, num);
    }
  },

  erase() {
    const { game, selectedCell } = get();
    if (!game || selectedCell == null || isGivenCell(game.givens, selectedCell)) {
      return;
    }
    const values = game.values.slice();
    const notes = game.notes.slice();
    values[selectedCell] = null;
    notes[selectedCell] = 0;
    const next: GameState = { ...game, values, notes };
    set({ game: next });
    persist(next);
  },
}));

type SetFn = (partial: Partial<GameStore>) => void;
type GetFn = () => GameStore;

/** Place or toggle a number into a cell, honoring notes mode and givens. */
function applyNumber(set: SetFn, get: GetFn, index: number, num: number): void {
  const { game, notesMode } = get();
  if (!game || isGivenCell(game.givens, index)) {
    return;
  }

  if (notesMode) {
    const notes = game.notes.slice();
    notes[index] = toggleNote(notes[index], num);
    const next: GameState = { ...game, notes };
    set({ game: next });
    persist(next);
    return;
  }

  const values = game.values.slice();
  // Tapping the same value again clears it.
  const nextValue = values[index] === num ? null : num;
  values[index] = nextValue;

  let { notes } = game;
  let mistakes = game.mistakes;
  if (nextValue != null) {
    notes = cleanupNotesAfterPlacement(game.notes, index, nextValue);
    if (!isValueCorrect(game.solution, index, nextValue)) {
      mistakes += 1;
    }
  }

  let next: GameState = { ...game, values, notes, mistakes };
  set({ game: next });

  if (isPuzzleComplete(values, game.solution)) {
    next = { ...next, status: "completed" };
    set({ game: next, justCompleted: true });
    void completeGame(next).catch(() => {});
    return;
  }

  persist(next);
}
