import { useMemo } from "react";

import { getPeerIndices, hasDuplicate, isGivenCell } from "@/domain/sudoku/board";
import { BOARD_SIZE } from "@/domain/sudoku/types";
import { useGameStore } from "@/state/useGameStore";
import { View } from "@/tw";

import { SudokuCell } from "./SudokuCell";

const ROWS = Array.from({ length: BOARD_SIZE }, (_, i) => i);

export function SudokuBoard() {
  const game = useGameStore((s) => s.game);
  const selectedCell = useGameStore((s) => s.selectedCell);
  const pressCell = useGameStore((s) => s.pressCell);

  const peers = useMemo(
    () => (selectedCell == null ? new Set<number>() : new Set(getPeerIndices(selectedCell))),
    [selectedCell],
  );

  if (!game) {
    return null;
  }

  const selectedValue = selectedCell == null ? null : game.values[selectedCell];

  return (
    <View className="aspect-square w-full overflow-hidden rounded-md border-2 border-neutral-400 bg-white dark:border-neutral-500 dark:bg-neutral-950">
      {ROWS.map((row) => (
        <View key={row} className="flex-1 flex-row">
          {ROWS.map((col) => {
            const index = row * BOARD_SIZE + col;
            const value = game.values[index];
            return (
              <SudokuCell
                key={index}
                index={index}
                value={value}
                notes={game.notes[index]}
                isGiven={isGivenCell(game.givens, index)}
                isSelected={selectedCell === index}
                isPeer={peers.has(index)}
                isSameValue={value != null && value === selectedValue}
                isConflict={value != null && hasDuplicate(game.values, index)}
                onPress={pressCell}
              />
            );
          })}
        </View>
      ))}
    </View>
  );
}
