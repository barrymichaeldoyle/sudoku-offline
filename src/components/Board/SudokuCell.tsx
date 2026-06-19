import type { CellValue, NoteMask } from "@/domain/sudoku/types";

import { clsx } from "clsx";
import { memo } from "react";

import { getColIndex, getRowIndex } from "@/domain/sudoku/board";
import { notesToNumbers } from "@/domain/sudoku/notes";
import { Pressable, Text, View } from "@/tw";

type SudokuCellProps = {
  index: number;
  value: CellValue;
  notes: NoteMask;
  isGiven: boolean;
  isSelected: boolean;
  isPeer: boolean;
  isSameValue: boolean;
  isConflict: boolean;
  onPress: (index: number) => void;
};

// Cell background follows the state priority from the design guidelines:
// error > selected > same-number > peer > given > default.
function background({
  isConflict,
  isSelected,
  isSameValue,
  isPeer,
  isGiven,
}: Pick<
  SudokuCellProps,
  "isConflict" | "isSelected" | "isSameValue" | "isPeer" | "isGiven"
>): string {
  if (isConflict) return "bg-cell-error";
  if (isSelected) return "bg-cell-selected";
  if (isSameValue) return "bg-cell-same";
  if (isPeer) return "bg-cell-peer";
  if (isGiven) return "bg-cell-given";
  return "bg-cell";
}

// Number colour. The selected cell uses a fixed high-contrast ink because its
// fill is bright (gold/amber) in both themes; given/user stay distinguished by
// font weight there. Errors always read in the error colour.
function numberColor({
  isConflict,
  isSelected,
  isGiven,
}: Pick<SudokuCellProps, "isConflict" | "isSelected" | "isGiven">): string {
  if (isConflict) return "text-num-error";
  if (isSelected) return "text-cell-selected-ink";
  if (isGiven) return "text-num-given";
  return "text-num-user";
}

function SudokuCellComponent(props: SudokuCellProps) {
  const { index, value, notes, isGiven, isSelected, onPress } = props;
  const row = getRowIndex(index);
  const col = getColIndex(index);
  const a11yLabel =
    `Row ${row + 1}, column ${col + 1}` +
    (value != null ? `, ${value}${isGiven ? " given" : ""}` : ", empty");

  return (
    <Pressable
      onPress={() => onPress(index)}
      accessibilityRole="button"
      accessibilityLabel={a11yLabel}
      accessibilityState={{ selected: isSelected }}
      className={clsx(
        "flex-1 items-center justify-center border-[0.5px] border-grid-minor",
        // Thicker, high-contrast separators on 3x3 box boundaries.
        col % 3 === 2 && col !== 8 && "border-r-2 border-r-grid-major",
        row % 3 === 2 && row !== 8 && "border-b-2 border-b-grid-major",
        background(props),
      )}
    >
      {value != null ? (
        <Text
          className={clsx(
            "text-2xl",
            isGiven || props.isConflict ? "font-bold" : "font-semibold",
            numberColor(props),
          )}
        >
          {value}
        </Text>
      ) : notes ? (
        <View className="h-full w-full flex-row flex-wrap p-[1px]">
          {Array.from({ length: 9 }, (_, i) => i + 1).map((n) => (
            <View key={n} className="h-1/3 w-1/3 items-center justify-center">
              <Text
                className={clsx(
                  "text-[9px] font-medium leading-none",
                  isSelected ? "text-cell-selected-ink" : "text-num-note",
                )}
              >
                {notesToNumbers(notes).includes(n) ? n : ""}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
    </Pressable>
  );
}

export const SudokuCell = memo(SudokuCellComponent);
