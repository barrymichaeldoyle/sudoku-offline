import type { NoteCleanupScope } from "../settings";
import type { NoteMask } from "./types";

import { getBoxPeerIndices, getPeerIndices } from "./board";

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

/** A peer cell whose notes were changed by auto-cleanup, with its prior mask. */
export type ClearedNote = { cellIndex: number; previousNotes: NoteMask };

/**
 * After placing `value` at `cellIndex`, remove that note from peers and clear
 * the placed cell's own notes. `scope` chooses the peers: "all" (row, column,
 * and box — standard sudoku) or "box" (the same 3x3 box only). Returns a new
 * notes array (the input is left untouched) plus the peers whose notes actually
 * changed, so the change can be undone. The placed cell is not in `cleared`.
 */
export function cleanupNotesAfterPlacement(
  notes: NoteMask[],
  cellIndex: number,
  value: number,
  scope: NoteCleanupScope = "all",
): { notes: NoteMask[]; cleared: ClearedNote[] } {
  const next = notes.slice();
  next[cellIndex] = 0;
  const cleared: ClearedNote[] = [];
  const peers = scope === "box" ? getBoxPeerIndices(cellIndex) : getPeerIndices(cellIndex);
  for (const peer of peers) {
    const before = next[peer];
    const after = removeNote(before, value);
    if (after !== before) {
      cleared.push({ cellIndex: peer, previousNotes: before });
      next[peer] = after;
    }
  }
  return { notes: next, cleared };
}
