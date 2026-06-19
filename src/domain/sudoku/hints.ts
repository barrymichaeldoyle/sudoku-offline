import { getPeerIndices, isGivenCell } from "./board";
import { CELL_COUNT, type CellValue } from "./types";

/** Digits 1-9 that don't currently conflict with a peer at `index`. */
export function computeCandidates(values: CellValue[], index: number): number[] {
  if (values[index] != null) {
    return [];
  }
  const used = new Set<number>();
  for (const peer of getPeerIndices(index)) {
    const v = values[peer];
    if (v != null) {
      used.add(v);
    }
  }
  const candidates: number[] = [];
  for (let n = 1; n <= 9; n++) {
    if (!used.has(n)) {
      candidates.push(n);
    }
  }
  return candidates;
}

/**
 * Cooldown between hints, in milliseconds. Stops players from spamming the Hint
 * button (which would trivialize the puzzle) — applies to every reveal, premium
 * included. See docs/HINT_FLOW.md.
 */
export const HINT_COOLDOWN_MS = 30_000;

export type Hint = { index: number; value: number };

/**
 * Choose a cell to reveal: prefer an empty non-given cell that has exactly one
 * valid candidate (a "naked single"); otherwise the first empty non-given cell.
 * The revealed value always comes from the solution, so it is correct even if
 * the player has placed wrong values elsewhere. Returns null when the board has
 * no empty non-given cells left.
 */
export function findHintCell(values: CellValue[], givens: string, solution: string): Hint | null {
  let fallback = -1;
  for (let i = 0; i < CELL_COUNT; i++) {
    if (values[i] != null || isGivenCell(givens, i)) {
      continue;
    }
    if (fallback === -1) {
      fallback = i;
    }
    if (computeCandidates(values, i).length === 1) {
      return { index: i, value: Number(solution[i]) };
    }
  }
  if (fallback === -1) {
    return null;
  }
  return { index: fallback, value: Number(solution[fallback]) };
}
