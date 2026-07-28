import { parseValuesString } from "./board";
import { computeCandidates, describeHint, findHintCell } from "./hints";

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
    expect(hint).toEqual({
      index: 40,
      value: Number(SOLUTION[40]),
      candidates: [Number(SOLUTION[40])],
      strategy: "naked_single",
    });
  });

  it("prefers a naked-single cell over an earlier ambiguous one", () => {
    // Empty board: cell 0 has all 9 candidates (fallback), while cell 80's row
    // peers (cols 0-7 of row 8) are filled 1-8, leaving it a naked single (9).
    const values = parseValuesString("0".repeat(81));
    for (let col = 0; col < 8; col++) {
      values[72 + col] = col + 1; // row 8, cols 0-7 -> digits 1..8
    }
    const hint = findHintCell(values, givens, SOLUTION);
    expect(hint).toMatchObject({
      index: 80,
      value: Number(SOLUTION[80]),
      strategy: "naked_single",
    });
  });

  it("chooses the smallest honest candidate set when there is no naked single", () => {
    const values = parseValuesString("0".repeat(81));
    values[1] = 3;
    values[2] = 4;
    values[9] = 6;
    values[10] = 7;
    values[18] = 1;
    values[19] = 9;

    const hint = findHintCell(values, givens, SOLUTION);

    expect(hint?.strategy).toBe("candidate_choice");
    expect(hint?.candidates).toContain(hint?.value);
  });

  it("identifies when wrong peer entries block the solution candidate", () => {
    const values = parseValuesString(SOLUTION);
    values[0] = null;
    values[1] = Number(SOLUTION[0]); // wrong duplicate blocks cell 0's true value

    const hint = findHintCell(values, givens, SOLUTION);

    expect(hint).toMatchObject({
      index: 0,
      value: Number(SOLUTION[0]),
      strategy: "conflicting_entries",
    });
  });
});

describe("describeHint", () => {
  it("explains a naked single without overstating a generic reveal", () => {
    expect(
      describeHint({
        index: 10,
        value: 5,
        candidates: [5],
        strategy: "naked_single",
      }),
    ).toEqual(
      expect.objectContaining({
        title: "Only 5 fits",
        body: expect.stringContaining("Row 2, column 2"),
      }),
    );
  });

  it("lists remaining candidates for a non-single reveal", () => {
    expect(
      describeHint({
        index: 0,
        value: 5,
        candidates: [2, 5, 8],
        strategy: "candidate_choice",
      }).body,
    ).toContain("2, 5, and 8");
  });

  it("describes an inconsistent board as a conflict, not a deduction", () => {
    const explanation = describeHint({
      index: 80,
      value: 9,
      candidates: [],
      strategy: "conflicting_entries",
    });

    expect(explanation.title).toBe("Check nearby entries");
    expect(explanation.body).toContain("blocking the correct candidate");
    expect(explanation.body).not.toContain("only valid");
  });
});
