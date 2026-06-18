import { getPeerIndices } from "./board";
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

    const next = cleanupNotesAfterPlacement(notes, cell, value);
    for (const peer of getPeerIndices(cell)) {
      expect(hasNote(next[peer], value)).toBe(false);
      expect(hasNote(next[peer], 3)).toBe(true); // unrelated note preserved
    }
  });

  it("clears the placed cell's own notes", () => {
    const notes = Array.from({ length: 81 }, () => 0);
    notes[0] = addNote(addNote(0, 1), 2);
    const next = cleanupNotesAfterPlacement(notes, 0, 7);
    expect(next[0]).toBe(0);
  });

  it("does not affect non-peer cells and does not mutate the input", () => {
    const notes = Array.from({ length: 81 }, () => 0);
    notes[80] = addNote(0, 7); // 80 is not a peer of cell 0
    const snapshot = [...notes];

    const next = cleanupNotesAfterPlacement(notes, 0, 7);
    expect(hasNote(next[80], 7)).toBe(true);
    expect(notes).toEqual(snapshot); // input untouched
  });
});
