import { getBoxPeerIndices, getPeerIndices } from "./board";
import {
  addNote,
  cleanupNotesAfterPlacement,
  hasNote,
  noteMaskForNumber,
  notesToNumbers,
  removeNote,
  toggleNote,
} from "./notes";

describe("note bitmask", () => {
  it("maps numbers to bits", () => {
    expect(noteMaskForNumber(1)).toBe(1);
    expect(noteMaskForNumber(2)).toBe(2);
    expect(noteMaskForNumber(9)).toBe(256);
  });

  it("toggles, adds, removes, and reads notes", () => {
    let mask = 0;
    mask = toggleNote(mask, 3);
    expect(hasNote(mask, 3)).toBe(true);
    mask = toggleNote(mask, 3);
    expect(hasNote(mask, 3)).toBe(false);

    mask = addNote(addNote(0, 1), 5);
    expect(hasNote(mask, 1)).toBe(true);
    expect(hasNote(mask, 5)).toBe(true);
    mask = removeNote(mask, 1);
    expect(hasNote(mask, 1)).toBe(false);
    expect(hasNote(mask, 5)).toBe(true);
  });

  it("lists set note numbers ascending", () => {
    const mask = addNote(addNote(addNote(0, 9), 2), 5);
    expect(notesToNumbers(mask)).toEqual([2, 5, 9]);
    expect(notesToNumbers(0)).toEqual([]);
  });
});

describe("cleanupNotesAfterPlacement", () => {
  it("removes the placed number from every peer", () => {
    const notes = Array.from({ length: 81 }, () => 0);
    const cell = 0;
    const value = 7;
    for (const peer of getPeerIndices(cell)) {
      notes[peer] = addNote(addNote(0, value), 3); // note 7 + an unrelated note
    }

    const { notes: next, cleared } = cleanupNotesAfterPlacement(notes, cell, value);
    for (const peer of getPeerIndices(cell)) {
      expect(hasNote(next[peer], value)).toBe(false);
      expect(hasNote(next[peer], 3)).toBe(true); // unrelated note preserved
    }
    // Every peer carried note 7, so each is reported as cleared for undo.
    expect(cleared.map((c) => c.cellIndex).sort((a, b) => a - b)).toEqual(
      [...getPeerIndices(cell)].sort((a, b) => a - b),
    );
  });

  it("clears the placed cell's own notes", () => {
    const notes = Array.from({ length: 81 }, () => 0);
    notes[0] = addNote(addNote(0, 1), 2);
    const { notes: next } = cleanupNotesAfterPlacement(notes, 0, 7);
    expect(next[0]).toBe(0);
  });

  it("does not affect non-peer cells and does not mutate the input", () => {
    const notes = Array.from({ length: 81 }, () => 0);
    notes[80] = addNote(0, 7); // 80 is not a peer of cell 0
    const snapshot = [...notes];

    const { notes: next, cleared } = cleanupNotesAfterPlacement(notes, 0, 7);
    expect(hasNote(next[80], 7)).toBe(true);
    expect(cleared).toEqual([]); // no peer notes changed
    expect(notes).toEqual(snapshot); // input untouched
  });

  describe('scope: "box"', () => {
    it("clears notes only within the same box, leaving row/column peers", () => {
      const cell = 0;
      const value = 7;
      const notes = Array.from({ length: 81 }, () => 0);
      // Note 7 on every "all" peer of cell 0 (row, column, and box).
      for (const peer of getPeerIndices(cell)) {
        notes[peer] = noteMaskForNumber(value);
      }

      const { notes: next } = cleanupNotesAfterPlacement(notes, cell, value, "box");

      const boxPeers = new Set(getBoxPeerIndices(cell));
      for (const peer of getPeerIndices(cell)) {
        const inSameBox = boxPeers.has(peer);
        // Box peers lose the note; row/column-only peers keep it.
        expect(hasNote(next[peer], value)).toBe(inSameBox ? false : true);
      }
    });

    it("reports only box peers as cleared, for undo", () => {
      const cell = 0;
      const value = 7;
      const notes = Array.from({ length: 81 }, () => 0);
      for (const peer of getPeerIndices(cell)) {
        notes[peer] = noteMaskForNumber(value);
      }

      const { cleared } = cleanupNotesAfterPlacement(notes, cell, value, "box");
      expect(cleared.map((c) => c.cellIndex).sort((a, b) => a - b)).toEqual(
        [...getBoxPeerIndices(cell)].sort((a, b) => a - b),
      );
    });
  });
});
