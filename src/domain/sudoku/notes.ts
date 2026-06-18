import type { NoteMask } from "./types";

import { getPeerIndices } from "./board";

/** Bitmask for a single note number (1-9): note `n` => bit `n - 1`. */
export function noteMaskForNumber(num: number): NoteMask {
  return 1 << (num - 1);
}

export function hasNote(mask: NoteMask, num: number): boolean {
  return (mask & noteMaskForNumber(num)) !== 0;
}

export function toggleNote(mask: NoteMask, num: number): NoteMask {
  return mask ^ noteMaskForNumber(num);
}

export function addNote(mask: NoteMask, num: number): NoteMask {
  return mask | noteMaskForNumber(num);
}

export function removeNote(mask: NoteMask, num: number): NoteMask {
  return mask & ~noteMaskForNumber(num);
}

/** The note numbers (1-9, ascending) set in a mask. */
export function notesToNumbers(mask: NoteMask): number[] {
  const nums: number[] = [];
  for (let n = 1; n <= 9; n++) {
    if (hasNote(mask, n)) {
      nums.push(n);
    }
  }
  return nums;
}

/**
 * After placing `value` at `cellIndex`, remove that note from every peer and
 * clear the placed cell's own notes. Returns a new notes array; the input is
 * left untouched.
 */
export function cleanupNotesAfterPlacement(
  notes: NoteMask[],
  cellIndex: number,
  value: number,
): NoteMask[] {
  const next = notes.slice();
  next[cellIndex] = 0;
  for (const peer of getPeerIndices(cellIndex)) {
    next[peer] = removeNote(next[peer], value);
  }
  return next;
}
