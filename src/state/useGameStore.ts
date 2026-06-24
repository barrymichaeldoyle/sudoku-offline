import type { InputMode } from "@/domain/settings";
import type { CellValue, GameAction, GameState, NoteMask } from "@/domain/sudoku/types";

import { create } from "zustand";

import { completeGame, getGameById, saveGame } from "@/data/repositories/gameRepository";
import {
  isBoardFull,
  isGivenCell,
  isPuzzleComplete,
  isValueCorrect,
  parseValuesString,
} from "@/domain/sudoku/board";
import { findHintCell, HINT_COOLDOWN_MS } from "@/domain/sudoku/hints";
import { cleanupNotesAfterPlacement, toggleNote } from "@/domain/sudoku/notes";
import { CELL_COUNT } from "@/domain/sudoku/types";
import { adService } from "@/services/adService";
import { track } from "@/services/analyticsService";
import { haptics } from "@/services/haptics";
import { hasRemoveAds } from "@/state/useEntitlementStore";
import { getSettings, useSettingsStore } from "@/state/useSettingsStore";

export type { InputMode };

const SAVE_DEBOUNCE_MS = 600;

type GameStore = {
  game: GameState | null;
  loading: boolean;
  selectedCell: number | null;
  selectedNumber: number | null;
  notesMode: boolean;
  /** Number-first only: the erase tool is the active selection (no number). */
  eraseArmed: boolean;
  justCompleted: boolean;
  /** Board is completely filled but does not match the solution. */
  incorrectComplete: boolean;
  undoStack: GameAction[];

  /** True while a hint confirmation prompt is shown. */
  hintPromptVisible: boolean;
  /** Rewarded-ad upsell vs a simple confirm-before-reveal prompt. */
  hintPromptMode: "rewarded" | "confirm" | null;
  /** Epoch ms until which the Hint button is on cooldown, or null when ready. */
  hintCooldownUntil: number | null;

  /** Timer: in-memory wall-clock anchor; committed seconds live on game. */
  running: boolean;
  lastStartedAt: number | null;

  loadGame: (id: string) => Promise<void>;
  setGame: (game: GameState) => void;
  reset: () => void;
  /** Restart the current puzzle: board back to givens, progress cleared. */
  restart: () => void;

  setInputMode: (mode: InputMode) => void;
  toggleNotesMode: () => void;

  pressCell: (index: number) => void;
  pressNumber: (num: number) => void;
  erase: () => void;
  /**
   * Hint entry point. Always opens a prompt first so accidental taps do not
   * reveal a cell. Freemium online players see the rewarded-ad prompt; premium
   * and offline players see a simple confirm dialog (still free when offline).
   */
  requestHint: () => Promise<void>;
  /** Confirm a hint without watching an ad (premium or offline). */
  confirmHint: () => void;
  /** Watch the rewarded ad and, if granted, reveal one hint. */
  confirmRewardedHint: () => Promise<void>;
  dismissHintPrompt: () => void;
  /** Close the "board full but incorrect" modal (keep playing). */
  dismissIncorrectComplete: () => void;
  undo: () => void;

  pause: () => void;
  resume: () => void;
  /** Persist immediately (e.g. on app background); also pauses the timer. */
  flushAndPause: () => void;
  /** Keep timer running state in sync when settings change mid-game. */
  syncTimerFromSettings: () => void;
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

/** Entering the game screen to play should always start unpaused. */
function activateForPlay(game: GameState): GameState {
  if (game.status === "completed" || game.status === "abandoned") {
    return game;
  }
  return { ...game, status: "active" };
}

function timerStateForActiveGame(isActive: boolean): Pick<GameStore, "running" | "lastStartedAt"> {
  const track = isActive && getSettings().timerEnabled;
  return { running: track, lastStartedAt: track ? Date.now() : null };
}

export const useGameStore = create<GameStore>((set, get) => ({
  game: null,
  loading: false,
  selectedCell: null,
  selectedNumber: null,
  notesMode: false,
  eraseArmed: false,
  justCompleted: false,
  incorrectComplete: false,
  undoStack: [],
  hintPromptVisible: false,
  hintPromptMode: null,
  hintCooldownUntil: null,
  running: false,
  lastStartedAt: null,

  async loadGame(id) {
    const current = get().game;
    if (current?.id === id) {
      if (current.status === "paused") {
        if (getSettings().timerEnabled) {
          get().resume();
        } else {
          set({ game: { ...current, status: "active" } });
        }
      }
      return;
    }
    set({ loading: true });
    const loaded = await getGameById(id);
    const game = loaded ? activateForPlay(loaded) : loaded;
    const isActive = game != null && game.status !== "completed" && game.status !== "abandoned";
    set({
      game,
      loading: false,
      selectedCell: null,
      selectedNumber: null,
      notesMode: false,
      eraseArmed: false,
      justCompleted: false,
      incorrectComplete: false,
      undoStack: [],
      hintPromptVisible: false,
      hintPromptMode: null,
      hintCooldownUntil: null,
      ...timerStateForActiveGame(isActive),
    });
  },

  setGame(game) {
    const active = activateForPlay(game);
    const isActive = active.status !== "completed" && active.status !== "abandoned";
    set({
      game: active,
      selectedCell: null,
      selectedNumber: null,
      notesMode: false,
      eraseArmed: false,
      justCompleted: false,
      incorrectComplete: false,
      undoStack: [],
      hintPromptVisible: false,
      hintPromptMode: null,
      hintCooldownUntil: null,
      ...timerStateForActiveGame(isActive),
    });
  },

  reset() {
    flushSave();
    set({
      game: null,
      selectedCell: null,
      selectedNumber: null,
      eraseArmed: false,
      justCompleted: false,
      incorrectComplete: false,
      undoStack: [],
      hintPromptVisible: false,
      hintPromptMode: null,
      hintCooldownUntil: null,
      running: false,
      lastStartedAt: null,
    });
  },

  restart() {
    const { game } = get();
    if (!game) {
      return;
    }
    // Rebuild the board from the givens and wipe all progress, keeping the same
    // game id (so a daily/challenge stays linked to its day).
    const next: GameState = {
      ...game,
      values: parseValuesString(game.givens),
      notes: Array.from({ length: CELL_COUNT }, () => 0),
      mistakes: 0,
      hintsUsed: 0,
      elapsedSeconds: 0,
      status: "active",
      completedAt: null,
      updatedAt: new Date().toISOString(),
    };
    void track("puzzle_restarted", { difficulty: game.difficulty });
    haptics.place();
    set({
      game: next,
      selectedCell: null,
      selectedNumber: null,
      notesMode: false,
      eraseArmed: false,
      justCompleted: false,
      incorrectComplete: false,
      undoStack: [],
      hintPromptVisible: false,
      hintPromptMode: null,
      hintCooldownUntil: null,
      ...timerStateForActiveGame(true),
    });
    scheduleSave(next);
  },

  setInputMode(mode) {
    // Input mode is a persisted setting shared with the Settings screen; the
    // selection state it governs is per-game, so clear it on every switch.
    useSettingsStore.getState().setSetting("inputMode", mode);
    set({ selectedCell: null, selectedNumber: null, eraseArmed: false });
  },

  toggleNotesMode() {
    haptics.toggle();
    set((state) => ({ notesMode: !state.notesMode }));
  },

  pressCell(index) {
    const { selectedNumber, eraseArmed } = get();
    if (getSettings().inputMode === "number") {
      // Erase tool armed → tapping a cell clears it; otherwise place the number.
      if (eraseArmed) {
        eraseCellAt(set, get, index);
        return;
      }
      if (selectedNumber != null) {
        applyNumber(set, get, index, selectedNumber);
        return;
      }
    }
    set({ selectedCell: index });
  },

  pressNumber(num) {
    const { selectedCell } = get();
    if (getSettings().inputMode === "number") {
      // Selecting a number always disarms the erase tool.
      set((state) => ({
        selectedNumber: state.selectedNumber === num ? null : num,
        eraseArmed: false,
      }));
      return;
    }
    if (selectedCell != null) {
      applyNumber(set, get, selectedCell, num);
    }
  },

  erase() {
    const { selectedCell } = get();
    // Number-first: erase is a toggleable tool (clears any selected number).
    if (getSettings().inputMode === "number") {
      set((state) => ({ eraseArmed: !state.eraseArmed, selectedNumber: null }));
      return;
    }
    // Cell-first: erase the currently selected cell immediately.
    if (selectedCell != null) {
      eraseCellAt(set, get, selectedCell);
    }
  },

  async requestHint() {
    const { game, hintCooldownUntil } = get();
    if (!game) {
      return;
    }
    // Cooldown: stop hint spamming so the puzzle stays a challenge.
    if (hintCooldownUntil != null && Date.now() < hintCooldownUntil) {
      return;
    }
    // Nothing left to reveal — no-op, and never open the prompt for nothing.
    if (!findHintCell(game.values, game.givens, game.solution)) {
      return;
    }
    // Premium → confirm first unless they opted into instant hints in settings.
    if (hasRemoveAds()) {
      if (getSettings().instantHintsEnabled) {
        revealHint(set, get);
        return;
      }
      set({ hintPromptVisible: true, hintPromptMode: "confirm" });
      return;
    }
    const adReady = await adService.isRewardedHintAvailable().catch(() => false);
    if (!adReady) {
      set({ hintPromptVisible: true, hintPromptMode: "confirm" });
      return;
    }
    // Online and not premium → watch a rewarded ad to reveal the hint.
    void track("rewarded_hint_offered", { difficulty: game.difficulty });
    set({ hintPromptVisible: true, hintPromptMode: "rewarded" });
  },

  confirmHint() {
    revealHint(set, get);
  },

  async confirmRewardedHint() {
    const granted = await adService.showRewardedHintAd();
    if (!granted) {
      // No reward (e.g. offline / no inventory). Leave the prompt to show its
      // own unavailable message; the user can dismiss it.
      return;
    }
    const game = get().game;
    void track("rewarded_hint_watched", { difficulty: game?.difficulty ?? "" });
    revealHint(set, get);
  },

  dismissHintPrompt() {
    set({ hintPromptVisible: false, hintPromptMode: null });
  },

  dismissIncorrectComplete() {
    set({ incorrectComplete: false });
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
      // Restore peer notes that auto-cleanup removed when this value was placed.
      for (const cleared of action.clearedNotes ?? []) {
        notes[cleared.cellIndex] = cleared.previousNotes;
      }
    } else if (action.type === "set_notes") {
      notes[action.cellIndex] = action.previousNotes;
    } else {
      values[action.cellIndex] = action.previousValue;
      notes[action.cellIndex] = action.previousNotes;
    }

    const next: GameState = { ...game, values, notes };
    haptics.place();
    set({
      game: next,
      selectedCell: action.cellIndex,
      undoStack: undoStack.slice(0, -1),
      // Undoing a revealed hint lifts its cooldown so the button is usable again
      // (the hintsUsed tally stays — the hint was still spent).
      ...(action.type === "place_value" && action.fromHint ? { hintCooldownUntil: null } : {}),
    });
    scheduleSave(next);
  },

  pause() {
    if (!getSettings().timerEnabled) {
      return;
    }
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
    if (!getSettings().timerEnabled) {
      set({ game: { ...game, status: "active" } });
      return;
    }
    set({ game: { ...game, status: "active" }, running: true, lastStartedAt: Date.now() });
  },

  flushAndPause() {
    if (getSettings().timerEnabled) {
      get().pause();
    }
    flushSave();
  },

  syncTimerFromSettings() {
    const state = get();
    const { game, running } = state;
    if (!game || game.status === "completed" || game.status === "abandoned") {
      return;
    }

    const timerEnabled = getSettings().timerEnabled;

    if (!timerEnabled) {
      if (running) {
        const committed = commitElapsed(state);
        set({ game: committed, running: false, lastStartedAt: null });
        scheduleSave(committed);
      } else if (game.status === "paused") {
        set({ game: { ...game, status: "active" }, running: false, lastStartedAt: null });
      }
      return;
    }

    if (game.status === "paused") {
      set({ running: false, lastStartedAt: null });
      return;
    }

    if (!running) {
      set({ running: true, lastStartedAt: Date.now() });
    }
  },
}));

type SetFn = (partial: Partial<GameStore>) => void;
type GetFn = () => GameStore;

/** Place or toggle a number into a cell, honoring notes mode and givens. */
/** Clear a cell's value and notes (recording an undo action). No-op on givens. */
function eraseCellAt(set: SetFn, get: GetFn, index: number): void {
  const { game, undoStack } = get();
  if (!game || isGivenCell(game.givens, index)) {
    return;
  }
  const previousValue = game.values[index];
  const previousNotes = game.notes[index];
  if (previousValue == null && previousNotes === 0) {
    return;
  }
  const values = game.values.slice();
  const notes = game.notes.slice();
  values[index] = null;
  notes[index] = 0;
  const next: GameState = { ...game, values, notes };
  const action: GameAction = { type: "erase", cellIndex: index, previousValue, previousNotes };
  haptics.place();
  set({ game: next, undoStack: [...undoStack, action] });
  scheduleSave(next);
}

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
    haptics.place();
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
  let clearedNotes: { cellIndex: number; previousNotes: NoteMask }[] | undefined;
  const correct = nextValue == null || isValueCorrect(game.solution, index, nextValue);
  if (nextValue != null) {
    if (getSettings().autoNoteCleanup) {
      const cleanup = cleanupNotesAfterPlacement(
        game.notes,
        index,
        nextValue,
        getSettings().autoNoteCleanupScope,
      );
      notes = cleanup.notes;
      clearedNotes = cleanup.cleared;
    } else {
      notes = game.notes.slice();
    }
    notes[index] = 0;
    if (!correct && getSettings().mistakeCheckingEnabled) {
      mistakes += 1;
    }
    if (!correct && getSettings().mistakeCheckingEnabled) {
      haptics.invalid();
    } else {
      haptics.place();
    }
  } else {
    // Re-tapping the same value clears the cell — give the same tap as erasing.
    haptics.place();
  }

  const action: GameAction = {
    type: "place_value",
    cellIndex: index,
    previousValue,
    nextValue,
    previousNotes,
    nextNotes: nextValue == null ? previousNotes : 0,
    clearedNotes,
  };
  const next: GameState = { ...game, values, notes, mistakes };
  set({ game: next, undoStack: [...undoStack, action] });
  finalizeAfterPlacement(set, get, next, values, isBoardFull(game.values));
}

/**
 * Reveal one correct cell from the solution and bump `hintsUsed`. Prefers a
 * naked single, else the first empty cell (see `findHintCell`). Closes the
 * rewarded-hint prompt if it was open. No-op when nothing is left to reveal.
 */
function revealHint(set: SetFn, get: GetFn): void {
  const { game, undoStack } = get();
  if (!game) {
    return;
  }
  const found = findHintCell(game.values, game.givens, game.solution);
  if (!found) {
    set({ hintPromptVisible: false, hintPromptMode: null });
    return;
  }
  const { index, value } = found;
  const previousValue = game.values[index];
  const previousNotes = game.notes[index];
  const values = game.values.slice();
  values[index] = value;
  let notes: NoteMask[];
  let clearedNotes: { cellIndex: number; previousNotes: NoteMask }[] | undefined;
  if (getSettings().autoNoteCleanup) {
    const cleanup = cleanupNotesAfterPlacement(
      game.notes,
      index,
      value,
      getSettings().autoNoteCleanupScope,
    );
    notes = cleanup.notes;
    clearedNotes = cleanup.cleared;
  } else {
    notes = game.notes.slice();
  }
  notes[index] = 0;

  const action: GameAction = {
    type: "place_value",
    cellIndex: index,
    previousValue,
    nextValue: value,
    previousNotes,
    nextNotes: 0,
    clearedNotes,
    fromHint: true,
  };
  const next: GameState = { ...game, values, notes, hintsUsed: game.hintsUsed + 1 };
  haptics.place();
  void track("hint_used", { difficulty: game.difficulty });
  set({
    game: next,
    selectedCell: index,
    undoStack: [...undoStack, action],
    hintPromptVisible: false,
    hintPromptMode: null,
    hintCooldownUntil: Date.now() + HINT_COOLDOWN_MS,
  });
  finalizeAfterPlacement(set, get, next, values, isBoardFull(game.values));
}

/** Shared completion/persistence path for value placements and hints. */
function finalizeAfterPlacement(
  set: SetFn,
  get: GetFn,
  next: GameState,
  values: CellValue[],
  wasFull: boolean,
): void {
  if (isPuzzleComplete(values, next.solution)) {
    const committed = getSettings().timerEnabled ? commitElapsed({ ...get(), game: next }) : next;
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
  // The board just became completely filled but doesn't match the solution.
  // Only fire on the not-full → full transition so editing an already-full board
  // (replacing one wrong digit with another) doesn't re-pop the modal each tap.
  // The placement itself already fired a haptic, so we don't add a second here.
  if (!wasFull && isBoardFull(values)) {
    void track("puzzle_filled_incorrect", { difficulty: next.difficulty });
    set({ incorrectComplete: true });
  }
  scheduleSave(next);
}
