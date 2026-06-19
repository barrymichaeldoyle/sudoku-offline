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

function background({
  isSelected,
  isSameValue,
  isPeer,
}: Pick<SudokuCellProps, "isSelected" | "isSameValue" | "isPeer">): string {
  if (isSelected) return "bg-blue-200 dark:bg-blue-800";
  if (isSameValue) return "bg-blue-100 dark:bg-blue-900";
  if (isPeer) return "bg-neutral-100 dark:bg-neutral-800";
  return "bg-white dark:bg-neutral-950";
}

function SudokuCellComponent(props: SudokuCellProps) {
  const { index, value, notes, isGiven, isSelected, isConflict, onPress } = props;
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
        "flex-1 items-center justify-center border-[0.5px] border-neutral-300 dark:border-neutral-700",
        // Thicker separators on 3x3 box boundaries.
        col % 3 === 2 && col !== 8 && "border-r-2 border-r-neutral-400 dark:border-r-neutral-500",
        row % 3 === 2 && row !== 8 && "border-b-2 border-b-neutral-400 dark:border-b-neutral-500",
        background(props),
      )}
    >
      {value != null ? (
        <Text
          className={clsx(
            "text-xl",
            isGiven
              ? "font-semibold text-neutral-900 dark:text-neutral-100"
              : isConflict
                ? "text-red-500"
                : "text-blue-600 dark:text-blue-400",
          )}
        >
          {value}
        </Text>
      ) : notes ? (
        <View className="h-full w-full flex-row flex-wrap p-[1px]">
          {Array.from({ length: 9 }, (_, i) => i + 1).map((n) => (
            <View key={n} className="h-1/3 w-1/3 items-center justify-center">
              <Text className="text-[8px] leading-none text-neutral-500 dark:text-neutral-400">
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
