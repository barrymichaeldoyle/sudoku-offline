type NumberColorState = {
  isConflict: boolean;
  isSelected: boolean;
  isGiven: boolean;
  isHint: boolean;
  colorUserValues: boolean;
  colorHintValues: boolean;
};

/** Resolve number ink while preserving category colors through selection. */
export function numberColor({
  isConflict,
  isSelected,
  isGiven,
  isHint,
  colorUserValues,
  colorHintValues,
}: NumberColorState): string {
  if (isConflict) return "text-num-error";
  if (isSelected) {
    if (isGiven) return "text-cell-selected-ink";
    // Not plain success green: the sage tones vanish on the gold/amber fill,
    // so hints get a deeper green sibling, mirroring the user-entry blue.
    if (isHint) return colorHintValues ? "text-num-hint-selected" : "text-cell-selected-ink";
    return colorUserValues ? "text-num-user-selected" : "text-cell-selected-ink";
  }
  if (isGiven) return "text-num-given";
  if (isHint) return colorHintValues ? "text-success" : "text-num-given";
  return colorUserValues ? "text-num-user" : "text-num-given";
}
