import {
  givensMatchSolution,
  isSolvedGrid,
  isValidGivensString,
  isValidSolutionString,
  validatePuzzle,
} from "./validation";

const GIVENS = "530070000600195000098000060800060003400803001700020006060000280000419005000080079";
const SOLUTION =
  "534678912672195348198342567859761423426853791713924856961537284287419635345286179";

describe("string validators", () => {
  it("validates givens strings", () => {
    expect(isValidGivensString(GIVENS)).toBe(true);
    expect(isValidGivensString("0".repeat(81))).toBe(true);
    expect(isValidGivensString("0".repeat(80))).toBe(false); // too short
    expect(isValidGivensString("a".repeat(81))).toBe(false); // non-digit
  });

  it("validates solution strings (no zeros)", () => {
    expect(isValidSolutionString(SOLUTION)).toBe(true);
    expect(isValidSolutionString(GIVENS)).toBe(false); // contains zeros
  });
});

describe("isSolvedGrid", () => {
  it("accepts a valid solved grid", () => {
    expect(isSolvedGrid(SOLUTION)).toBe(true);
  });

  it("rejects a grid with a repeated value in a row", () => {
    // Swap a cell to create a row duplicate.
    const broken = `1${SOLUTION.slice(1)}`;
    expect(isSolvedGrid(broken)).toBe(SOLUTION.startsWith("1"));
  });

  it("rejects an all-ones grid", () => {
    expect(isSolvedGrid("1".repeat(81))).toBe(false);
  });
});

describe("givensMatchSolution", () => {
  it("is true when givens agree with the solution", () => {
    expect(givensMatchSolution(GIVENS, SOLUTION)).toBe(true);
  });

  it("is false when a given contradicts the solution", () => {
    const bad = `9${GIVENS.slice(1)}`; // solution[0] is '5'
    expect(givensMatchSolution(bad, SOLUTION)).toBe(false);
  });
});

describe("validatePuzzle", () => {
  it("accepts a valid puzzle pair", () => {
    expect(validatePuzzle({ givens: GIVENS, solution: SOLUTION })).toEqual({
      valid: true,
      errors: [],
    });
  });

  it("reports a malformed solution", () => {
    const result = validatePuzzle({ givens: GIVENS, solution: "1".repeat(81) });
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it("reports mismatched givens", () => {
    const result = validatePuzzle({ givens: `9${GIVENS.slice(1)}`, solution: SOLUTION });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("givens do not match the solution");
  });
});
