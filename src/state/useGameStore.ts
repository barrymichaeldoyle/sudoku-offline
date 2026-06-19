import type { CellValue, GameAction, GameState, NoteMask } from "@/domain/sudoku/types";

import { create } from "zustand";

import { completeGame, getGameById, saveGame } from "@/data/repositories/gameRepository";
import { isGivenCell, isPuzzleComplete, isValueCorrect } from "@/domain/sudoku/board";
import { findHintCell } from "@/domain/sudoku/hints";
import { cleanupNotesAfterPlacement, toggleNote } from "@/domain/sudoku/notes";
import { track } from "@/services/analyticsService";
import { haptics } from "@/services/haptics";
import { getSettings } from "@/state/useSettingsStore";

export type InputMode = "cell" | "number";

const SAVE_DEBOUNCE_MS = 600;

type GameStore = {
  game: GameState | null;
  loading: boolean;
  selectedCell: number | null;
  selectedNumber: number | null;
  inputMode: InputMode;
  notesMode: boolean;
  justCompleted: boolean;
  undoStack: GameAction[];

  /** Timer: in-memory wall-clock anchor; committed seconds live on game. */
  running: boolean;
  lastStartedAt: number | null;

  loadGame: (id: string) => Promise<void>;
  setGame: (game: GameState) => void;
  reset: () => void;

  setInputMode: (mode: InputMode) => void;
  toggleNotesMode: () => void;

  pressCell: (index: number) => void;
  pressNumber: (num: number) => void;
  erase: () => void;
  hint: () => void;
  undo: () => void;

  pause: () => void;
  resume: () => void;
  /** Persist immediately (e.g. on app background); also pauses the timer. */
  flushAndPause: () => void;
};

// --- Debounced persistence ---------------------------------------------------
let saveTimer: ReturnType<typeof setTimeout> | null = null;
let pendingGame: GameState | null = null;

function scheduleSave(game: GameState): void {
  pendingGame = game;
  if (saveTimer) {
    clearTimeout(saveTimer);
  }
  saveTimer = setTimeout(flushSave, SAVE_DEBOUNCE_MS);
}

function flushSave(): void {
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  if (pendingGame) {
    const game = pendingGame;
    pendingGame = null;
    void saveGame(game).catch(() => {});
  }
}

// --- Timer helper ------------------------------------------------------------
function commitElapsed(state: Pick<GameStore, "game" | "running" | "lastStartedAt">): GameState {
  const { game, running, lastStartedAt } = state;
  if (!game || !running || lastStartedAt == null) {
    return game as GameState;
  }
  const delta = Math.floor((Date.now() - lastStartedAt) / 1000);
  return { ...game, elapsedSeconds: game.elapsedSeconds + delta };
}

export const useGameStore = create<GameStore>((set, get) => ({
  game: null,
  loading: false,
  selectedCell: null,
  selectedNumber: null,
  inputMode: "cell",
  notesMode: false,
  justCompleted: false,
  undoStack: [],
  running: false,
  lastStartedAt: null,

  async loadGame(id) {
    if (get().game?.id === id) {
      return;
    }
    set({ loading: true });
    const game = await getGameById(id);
    const isActive = game != null && game.status !== "completed" && game.status !== "abandoned";
    set({
      game,
      loading: false,
      selectedCell: null,
      selectedNumber: null,
      notesMode: false,
      justCompleted: false,
      undoStack: [],
      running: isActive,
      lastStartedAt: isActive ? Date.now() : null,
    });
  },

  setGame(game) {
    const isActive = game.status !== "completed" && game.status !== "abandoned";
    set({
      game,
      selectedCell: null,
      selectedNumber: null,
      notesMode: false,
      justCompleted: false,
      undoStack: [],
      running: isActive,
      lastStartedAt: isActive ? Date.now() : null,
    });
  },

  reset() {
    flushSave();
    set({
      game: null,
      selectedCell: null,
      selectedNumber: null,
      justCompleted: false,
      undoStack: [],
      running: false,
      lastStartedAt: null,
    });
  },

  setInputMode(mode) {
    set({ inputMode: mode, selectedCell: null, selectedNumber: null });
  },

  toggleNotesMode() {
    haptics.toggle();
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
    const previousValue = game.values[selectedCell];
    const previousNotes = game.notes[selectedCell];
    if (previousValue == null && previousNotes === 0) {
      return;
    }
    const values = game.values.slice();
    const notes = game.notes.slice();
    values[selectedCell] = null;
    notes[selectedCell] = 0;
    const next: GameState = { ...game, values, notes };
    const action: GameAction = {
      type: "erase",
      cellIndex: selectedCell,
      previousValue,
      previousNotes,
    };
    set({ game: next, undoStack: [...get().undoStack, action] });
    scheduleSave(next);
  },

  hint() {
    const { game } = get();
    if (!game) {
      return;
    }
    const found = findHintCell(game.values, game.givens, game.solution);
    if (!found) {
      return;
    }
    const { index, value } = found;
    const previousValue = game.values[index];
    const previousNotes = game.notes[index];
    const values = game.values.slice();
    values[index] = value;
    const notes = getSettings().autoNoteCleanup
      ? cleanupNotesAfterPlacement(game.notes, index, value)
      : game.notes.slice();
    notes[index] = 0;

    const action: GameAction = {
      type: "place_value",
      cellIndex: index,
      previousValue,
      nextValue: value,
      previousNotes,
      nextNotes: 0,
    };
    let next: GameState = { ...game, values, notes, hintsUsed: game.hintsUsed + 1 };
    haptics.place();
    void track("hint_used", { difficulty: game.difficulty });
    set({ game: next, selectedCell: index, undoStack: [...get().undoStack, action] });
    finalizeAfterPlacement(set, get, next, values);
  },

  undo() {
    const { game, undoStack } = get();
    if (!game || undoStack.length === 0) {
      return;
    }
    const action = undoStack[undoStack.length - 1];
    const values = game.values.slice();
    const notes = game.notes.slice();

    if (action.type === "place_value") {
      values[action.cellIndex] = action.previousValue;
      notes[action.cellIndex] = action.previousNotes;
    } else if (action.type === "set_notes") {
      notes[action.cellIndex] = action.previousNotes;
    } else {
      values[action.cellIndex] = action.previousValue;
      notes[action.cellIndex] = action.previousNotes;
    }

    const next: GameState = { ...game, values, notes };
    set({
      game: next,
      selectedCell: action.cellIndex,
      undoStack: undoStack.slice(0, -1),
    });
    scheduleSave(next);
  },

  pause() {
    const state = get();
    if (!state.game || !state.running) {
      return;
    }
    const committed = commitElapsed(state);
    const next: GameState = { ...committed, status: "paused" };
    set({ game: next, running: false, lastStartedAt: null });
    pendingGame = next;
    flushSave();
  },

  resume() {
    const { game } = get();
    if (!game || game.status === "completed") {
      return;
    }
    set({ game: { ...game, status: "active" }, running: true, lastStartedAt: Date.now() });
  },

  flushAndPause() {
    get().pause();
    flushSave();
  },
}));

type SetFn = (partial: Partial<GameStore>) => void;
type GetFn = () => GameStore;

/** Place or toggle a number into a cell, honoring notes mode and givens. */
function applyNumber(set: SetFn, get: GetFn, index: number, num: number): void {
  const { game, notesMode, undoStack } = get();
  if (!game || isGivenCell(game.givens, index)) {
    return;
  }

  if (notesMode) {
    const previousNotes = game.notes[index];
    const notes = game.notes.slice();
    notes[index] = toggleNote(previousNotes, num);
    const next: GameState = { ...game, notes };
    const action: GameAction = {
      type: "set_notes",
      cellIndex: index,
      previousNotes,
      nextNotes: notes[index],
    };
    haptics.toggle();
    set({ game: next, undoStack: [...undoStack, action] });
    scheduleSave(next);
    return;
  }

  const previousValue = game.values[index];
  const previousNotes = game.notes[index];
  // Tapping the same value again clears it.
  const nextValue: CellValue = previousValue === num ? null : num;

  const values = game.values.slice();
  values[index] = nextValue;

  let notes: NoteMask[] = game.notes;
  let mistakes = game.mistakes;
  const correct = nextValue == null || isValueCorrect(game.solution, index, nextValue);
  if (nextValue != null) {
    notes = getSettings().autoNoteCleanup
      ? cleanupNotesAfterPlacement(game.notes, index, nextValue)
      : game.notes.slice();
    notes[index] = 0;
    if (!correct) {
      mistakes += 1;
    }
    if (!correct && getSettings().mistakeCheckingEnabled) {
      haptics.invalid();
    } else {
      haptics.place();
    }
  }

  const action: GameAction = {
    type: "place_value",
    cellIndex: index,
    previousValue,
    nextValue,
    previousNotes,
    nextNotes: nextValue == null ? previousNotes : 0,
  };
  const next: GameState = { ...game, values, notes, mistakes };
  set({ game: next, undoStack: [...undoStack, action] });
  finalizeAfterPlacement(set, get, next, values);
}

/** Shared completion/persistence path for value placements and hints. */
function finalizeAfterPlacement(
  set: SetFn,
  get: GetFn,
  next: GameState,
  values: CellValue[],
): void {
  if (isPuzzleComplete(values, next.solution)) {
    const committed = commitElapsed({ ...get(), game: next });
    const completed: GameState = { ...committed, status: "completed" };
    if (saveTimer) {
      clearTimeout(saveTimer);
      saveTimer = null;
    }
    pendingGame = null;
    set({ game: completed, justCompleted: true, running: false, lastStartedAt: null });
    haptics.complete();
    void track("puzzle_completed", {
      difficulty: completed.difficulty,
      elapsedSeconds: completed.elapsedSeconds,
      mistakes: completed.mistakes,
      hintsUsed: completed.hintsUsed,
    });
    void completeGame(completed).catch(() => {});
    return;
  }
  scheduleSave(next);
}
