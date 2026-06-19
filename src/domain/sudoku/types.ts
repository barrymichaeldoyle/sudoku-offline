export type Difficulty = "easy" | "medium" | "hard" | "expert" | "extreme";

/** All difficulty tiers, including the challenge-only "extreme" tier (used for
 * stats iteration and exhaustive Record keys). */
export const DIFFICULTIES: readonly Difficulty[] = ["easy", "medium", "hard", "expert", "extreme"];

/** Difficulties offered as ordinary "New Game" options. "extreme" is excluded —
 * it is only reachable via the Daily Challenge. */
export const NEW_GAME_DIFFICULTIES: readonly Difficulty[] = ["easy", "medium", "hard", "expert"];

export type PuzzleSource = "bundled" | "downloaded" | "generated";

export type Puzzle = {
  id: string;
  difficulty: Difficulty;
  /** 81-char string, "0" for empty cells. */
  givens: string;
  /** 81-char string, digits 1-9. */
  solution: string;
  source: PuzzleSource;
  dateKey?: string | null;
};

/** A placed cell value (1-9) or null when empty. */
export type CellValue = number | null;

/** Pencil-note bitmask: note `n` (1-9) occupies bit `n - 1`. */
export type NoteMask = number;

export type GameStatus = "active" | "paused" | "completed" | "abandoned";

export type GameState = {
  id: string;
  puzzleId: string;
  difficulty: Difficulty;
  givens: string;
  solution: string;
  values: CellValue[];
  notes: NoteMask[];
  status: GameStatus;
  elapsedSeconds: number;
  mistakes: number;
  hintsUsed: number;
  startedAt: string;
  completedAt: string | null;
  updatedAt: string;
};

export type GameAction =
  | {
      type: "place_value";
      cellIndex: number;
      previousValue: CellValue;
      nextValue: CellValue;
      previousNotes: NoteMask;
      nextNotes: NoteMask;
    }
  | {
      type: "set_notes";
      cellIndex: number;
      previousNotes: NoteMask;
      nextNotes: NoteMask;
    }
  | {
      type: "erase";
      cellIndex: number;
      previousValue: CellValue;
      previousNotes: NoteMask;
    };

/** Number of cells on a standard 9x9 board. */
export const CELL_COUNT = 81;
export const BOARD_SIZE = 9;
export const BOX_SIZE = 3;
