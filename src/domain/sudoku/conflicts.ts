import { isGivenCell } from "./board";
import { BOARD_SIZE, CELL_COUNT, type CellValue } from "./types";

function getBoxIndex(row: number, col: number): number {
  return Math.floor(row / 3) * 3 + Math.floor(col / 3);
}

/**
 * Per-cell error flags for the board. A user cell is in conflict when its value
 * duplicates another in its row/column/box, or doesn't match the solution.
 *
 * When `mistakeChecking` is off the board must reveal nothing — no
 * duplicate-in-row/column/box warnings and no correctness — so every cell is
 * reported conflict-free. Given cells are never flagged.
 */
export function computeConflicts(
  values: CellValue[],
  givens: string,
  solution: string,
  mistakeChecking: boolean,
): boolean[] {
  if (!mistakeChecking) {
    return Array<boolean>(CELL_COUNT).fill(false);
  }
  const rows = Array.from({ length: BOARD_SIZE }, () => Array<number>(BOARD_SIZE + 1).fill(0));
  const cols = Array.from({ length: BOARD_SIZE }, () => Array<number>(BOARD_SIZE + 1).fill(0));
  const boxes = Array.from({ length: BOARD_SIZE }, () => Array<number>(BOARD_SIZE + 1).fill(0));

  for (let index = 0; index < CELL_COUNT; index++) {
    const value = values[index];
    if (value == null) {
      continue;
    }
    const row = Math.floor(index / BOARD_SIZE);
    const col = index % BOARD_SIZE;
    const box = getBoxIndex(row, col);
    rows[row][value] += 1;
    cols[col][value] += 1;
    boxes[box][value] += 1;
  }

  const conflicts = Array<boolean>(CELL_COUNT).fill(false);
  for (let index = 0; index < CELL_COUNT; index++) {
    const value = values[index];
    if (value == null || isGivenCell(givens, index)) {
      continue;
    }
    const row = Math.floor(index / BOARD_SIZE);
    const col = index % BOARD_SIZE;
    const box = getBoxIndex(row, col);
    conflicts[index] =
      rows[row][value] > 1 ||
      cols[col][value] > 1 ||
      boxes[box][value] > 1 ||
      value !== Number(solution[index]);
  }
  return conflicts;
}
