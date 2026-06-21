import { parseValuesString } from "./board";
import { computeConflicts } from "./conflicts";

const GIVENS = "530070000600195000098000060800060003400803001700020006060000280000419005000080079";
const SOLUTION =
  "534678912672195348198342567859761423426853791713924856961537284287419635345286179";

describe("computeConflicts", () => {
  it("reports no conflicts for a fully-correct board", () => {
    const values = parseValuesString(SOLUTION);
    expect(computeConflicts(values, GIVENS, SOLUTION, true)).toEqual(Array(81).fill(false));
  });

  it("flags a user cell that doesn't match the solution", () => {
    const values = parseValuesString(SOLUTION);
    // Index 2 is empty in GIVENS; its solution is 4 — place a wrong value.
    values[2] = 1;
    const conflicts = computeConflicts(values, GIVENS, SOLUTION, true);
    expect(conflicts[2]).toBe(true);
  });

  it("never flags a given cell", () => {
    const values = parseValuesString(SOLUTION);
    values[2] = 1; // a wrong user value elsewhere
    const conflicts = computeConflicts(values, GIVENS, SOLUTION, true);
    // Index 0 is a given (5) — givens are authoritative and never marked.
    expect(conflicts[0]).toBe(false);
  });

  it("reveals nothing when mistake checking is off (regression)", () => {
    const values = parseValuesString(SOLUTION);
    values[2] = 1; // wrong value AND a duplicate in its row/box
    expect(computeConflicts(values, GIVENS, SOLUTION, false)).toEqual(Array(81).fill(false));
  });
});
