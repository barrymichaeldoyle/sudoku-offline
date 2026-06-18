import { getBoxIndex, getColIndex, getRowIndex } from "./board";
import { BOARD_SIZE, CELL_COUNT, type Puzzle } from "./types";

export function isValidGivensString(givens: string): boolean {
  return givens.length === CELL_COUNT && /^[0-9]{81}$/.test(givens);
}

export function isValidSolutionString(solution: string): boolean {
  return solution.length === CELL_COUNT && /^[1-9]{81}$/.test(solution);
}

/** True when the string is a fully valid solved grid (rows, cols, boxes each 1-9). */
export function isSolvedGrid(solution: string): boolean {
  if (!isValidSolutionString(solution)) {
    return false;
  }
  const rows: number[] = Array.from({ length: BOARD_SIZE }, () => 0);
  const cols: number[] = Array.from({ length: BOARD_SIZE }, () => 0);
  const boxes: number[] = Array.from({ length: BOARD_SIZE }, () => 0);

  for (let i = 0; i < CELL_COUNT; i++) {
    const bit = 1 << (solution.charCodeAt(i) - 49); // '1' (49) => bit 0
    const r = getRowIndex(i);
    const c = getColIndex(i);
    const b = getBoxIndex(i);
    if (rows[r] & bit || cols[c] & bit || boxes[b] & bit) {
      return false;
    }
    rows[r] |= bit;
    cols[c] |= bit;
    boxes[b] |= bit;
  }
  return true;
}

/** True when every non-empty given matches the same cell in the solution. */
export function givensMatchSolution(givens: string, solution: string): boolean {
  if (givens.length !== CELL_COUNT || solution.length !== CELL_COUNT) {
    return false;
  }
  for (let i = 0; i < CELL_COUNT; i++) {
    if (givens[i] !== "0" && givens[i] !== solution[i]) {
      return false;
    }
  }
  return true;
}

export type PuzzleValidationResult = {
  valid: boolean;
  errors: string[];
};

export function validatePuzzle(
  puzzle: Pick<Puzzle, "givens" | "solution">,
): PuzzleValidationResult {
  const errors: string[] = [];
  if (!isValidGivensString(puzzle.givens)) {
    errors.push("givens must be 81 characters of digits 0-9");
  }
  if (!isValidSolutionString(puzzle.solution)) {
    errors.push("solution must be 81 characters of digits 1-9");
  } else if (!isSolvedGrid(puzzle.solution)) {
    errors.push("solution is not a valid solved grid");
  }
  if (errors.length === 0 && !givensMatchSolution(puzzle.givens, puzzle.solution)) {
    errors.push("givens do not match the solution");
  }
  return { valid: errors.length === 0, errors };
}
