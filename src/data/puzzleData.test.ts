import { validatePuzzle } from "@/domain/sudoku/validation";

import { BUNDLED_PACKS } from "./puzzleData";

describe("bundled puzzle packs", () => {
  for (const pack of BUNDLED_PACKS) {
    describe(pack.id, () => {
      it("is non-empty", () => {
        expect(pack.puzzles.length).toBeGreaterThan(0);
      });

      it("has unique ids", () => {
        const ids = new Set(pack.puzzles.map((p) => p.id));
        expect(ids.size).toBe(pack.puzzles.length);
      });

      it("contains only valid puzzles", () => {
        const invalid = pack.puzzles
          .map((p) => ({ id: p.id, result: validatePuzzle(p) }))
          .filter((entry) => !entry.result.valid);
        expect(invalid).toEqual([]);
      });
    });
  }
});
