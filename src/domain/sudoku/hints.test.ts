import { parseValuesString } from "./board";
import { computeCandidates, findHintCell } from "./hints";

const SOLUTION =
  "534678912672195348198342567859761423426853791713924856961537284287419635345286179";

describe("computeCandidates", () => {
  it("returns no candidates for a filled cell", () => {
    const values = parseValuesString(SOLUTION);
    expect(computeCandidates(values, 0)).toEqual([]);
  });

  it("returns all digits for an empty board cell", () => {
    const values = parseValuesString("0".repeat(81));
    expect(computeCandidates(values, 0)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it("excludes digits used by peers", () => {
    const values = parseValuesString("0".repeat(81));
    values[1] = 5; // same row as cell 0
    values[9] = 6; // same column as cell 0
    values[20] = 7; // same box as cell 0
    expect(computeCandidates(values, 0)).toEqual([1, 2, 3, 4, 8, 9]);
  });
});

describe("findHintCell", () => {
  const givens = "0".repeat(81);

  it("returns null when there are no empty non-given cells", () => {
    const values = parseValuesString(SOLUTION);
    expect(findHintCell(values, SOLUTION, SOLUTION)).toBeNull();
  });

  it("reveals the solution value for the chosen cell", () => {
    const values = parseValuesString(SOLUTION);
    values[40] = null; // single empty cell
    const hint = findHintCell(values, givens, SOLUTION);
    expect(hint).toEqual({ index: 40, value: Number(SOLUTION[40]) });
  });

  it("prefers a naked-single cell over an earlier ambiguous one", () => {
    // Empty board: cell 0 has all 9 candidates (fallback), while cell 80's row
    // peers (cols 0-7 of row 8) are filled 1-8, leaving it a naked single (9).
    const values = parseValuesString("0".repeat(81));
    for (let col = 0; col < 8; col++) {
      values[72 + col] = col + 1; // row 8, cols 0-7 -> digits 1..8
    }
    const hint = findHintCell(values, givens, SOLUTION);
    expect(hint).toEqual({ index: 80, value: Number(SOLUTION[80]) });
  });
});
