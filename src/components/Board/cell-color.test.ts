import { numberColor } from "./cell-color";

const selectedHint = {
  isConflict: false,
  isSelected: true,
  isGiven: false,
  isHint: true,
  colorUserValues: true,
};

describe("numberColor", () => {
  it("uses the deep selected-hint green when a hinted cell is selected", () => {
    expect(numberColor({ ...selectedHint, colorHintValues: true })).toBe("text-num-hint-selected");
  });

  it("uses selected clue ink when hint coloring is disabled", () => {
    expect(numberColor({ ...selectedHint, colorHintValues: false })).toBe("text-cell-selected-ink");
  });
});
