import {
  getBoxIndex,
  getColIndex,
  getPeerIndices,
  getRowIndex,
  hasDuplicate,
  isBoardFull,
  isGivenCell,
  isPuzzleComplete,
  isValueCorrect,
  parseValuesString,
  valuesToString,
} from "./board";

const GIVENS = "530070000600195000098000060800060003400803001700020006060000280000419005000080079";
const SOLUTION =
  "534678912672195348198342567859761423426853791713924856961537284287419635345286179";

describe("index math", () => {
  it.each([
    [0, 0, 0, 0],
    [8, 0, 8, 2],
    [9, 1, 0, 0],
    [40, 4, 4, 4],
    [30, 3, 3, 4],
    [80, 8, 8, 8],
  ])("cell %i => row/col/box", (cell, row, col, box) => {
    expect(getRowIndex(cell)).toBe(row);
    expect(getColIndex(cell)).toBe(col);
    expect(getBoxIndex(cell)).toBe(box);
  });
});

describe("getPeerIndices", () => {
  it("returns exactly 20 unique peers excluding the cell itself", () => {
    const peers = getPeerIndices(0);
    expect(peers).toHaveLength(20);
    expect(peers).not.toContain(0);
    expect(new Set(peers).size).toBe(20);
  });

  it("includes row, column, and box peers", () => {
    const peers = getPeerIndices(0);
    // row 0
    expect(peers).toEqual(expect.arrayContaining([1, 2, 3, 4, 5, 6, 7, 8]));
    // column 0
    expect(peers).toEqual(expect.arrayContaining([9, 18, 27, 36, 45, 54, 63, 72]));
    // box 0 (the remaining unique members)
    expect(peers).toEqual(expect.arrayContaining([10, 11, 19, 20]));
  });

  it("is sorted ascending", () => {
    const peers = getPeerIndices(40);
    expect([...peers].sort((a, b) => a - b)).toEqual(peers);
  });
});

describe("parse/stringify", () => {
  it("round-trips a values string", () => {
    expect(valuesToString(parseValuesString(SOLUTION))).toBe(SOLUTION);
    expect(valuesToString(parseValuesString(GIVENS))).toBe(GIVENS);
  });

  it("maps zeros to null and digits to numbers", () => {
    const values = parseValuesString(GIVENS);
    expect(values[0]).toBe(5);
    expect(values[2]).toBeNull(); // '0'
    expect(values).toHaveLength(81);
  });
});

describe("isGivenCell", () => {
  it("detects non-zero givens", () => {
    expect(isGivenCell(GIVENS, 0)).toBe(true); // '5'
    expect(isGivenCell(GIVENS, 2)).toBe(false); // '0'
  });
});

describe("isValueCorrect", () => {
  it("compares against the solution", () => {
    expect(isValueCorrect(SOLUTION, 2, 4)).toBe(true); // solution[2] === '4'
    expect(isValueCorrect(SOLUTION, 2, 9)).toBe(false);
  });
});

describe("hasDuplicate", () => {
  it("is false for empty cells", () => {
    const values = parseValuesString("0".repeat(81));
    expect(hasDuplicate(values, 0)).toBe(false);
  });

  it("detects a duplicate within a row", () => {
    const values = parseValuesString("0".repeat(81));
    values[0] = 5;
    values[1] = 5; // same row as cell 0
    expect(hasDuplicate(values, 0)).toBe(true);
    expect(hasDuplicate(values, 1)).toBe(true);
  });

  it("detects a duplicate within a box but not across unrelated cells", () => {
    const values = parseValuesString("0".repeat(81));
    values[0] = 7;
    values[10] = 7; // same box (box 0)
    values[80] = 7; // unrelated
    expect(hasDuplicate(values, 0)).toBe(true);
    expect(hasDuplicate(values, 80)).toBe(false);
  });

  it("is false when the full solution is placed", () => {
    const values = parseValuesString(SOLUTION);
    for (let i = 0; i < 81; i++) {
      expect(hasDuplicate(values, i)).toBe(false);
    }
  });
});

describe("isPuzzleComplete", () => {
  it("is true for the full solution", () => {
    expect(isPuzzleComplete(parseValuesString(SOLUTION), SOLUTION)).toBe(true);
  });

  it("is false when a cell is empty", () => {
    const values = parseValuesString(SOLUTION);
    values[0] = null;
    expect(isPuzzleComplete(values, SOLUTION)).toBe(false);
  });

  it("is false when a filled cell is wrong", () => {
    const values = parseValuesString(SOLUTION);
    values[0] = values[0] === 9 ? 1 : 9;
    expect(isPuzzleComplete(values, SOLUTION)).toBe(false);
  });
});

describe("isBoardFull", () => {
  it("is true when every cell holds a value, even if wrong", () => {
    const values = parseValuesString(SOLUTION);
    values[0] = values[0] === 9 ? 1 : 9; // wrong but still filled
    expect(isBoardFull(values)).toBe(true);
  });

  it("is false when any cell is empty", () => {
    const values = parseValuesString(SOLUTION);
    values[42] = null;
    expect(isBoardFull(values)).toBe(false);
  });
});
