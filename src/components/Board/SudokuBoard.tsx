import { useMemo } from "react";

import { getPeerIndices, hasDuplicate, isGivenCell } from "@/domain/sudoku/board";
import { BOARD_SIZE } from "@/domain/sudoku/types";
import { useGameStore } from "@/state/useGameStore";
import { useSettingsStore } from "@/state/useSettingsStore";
import { View } from "@/tw";

import { SudokuCell } from "./SudokuCell";

const ROWS = Array.from({ length: BOARD_SIZE }, (_, i) => i);

export function SudokuBoard({ size }: { size?: number }) {
  const game = useGameStore((s) => s.game);
  const selectedCell = useGameStore((s) => s.selectedCell);
  const pressCell = useGameStore((s) => s.pressCell);
  const highlightPeers = useSettingsStore((s) => s.settings.highlightPeers);
  const highlightSameNumbers = useSettingsStore((s) => s.settings.highlightSameNumbers);
  const mistakeChecking = useSettingsStore((s) => s.settings.mistakeCheckingEnabled);

  const peers = useMemo(
    () => (selectedCell == null ? new Set<number>() : new Set(getPeerIndices(selectedCell))),
    [selectedCell],
  );

  if (!game) {
    return null;
  }

  const selectedValue = selectedCell == null ? null : game.values[selectedCell];

  return (
    <View
      // When a measured `size` is supplied the board renders as an exact square
      // that fits the available space (so controls are never crowded); otherwise
      // it falls back to filling its container width.
      style={size != null ? { width: size, height: size } : undefined}
      className={
        size != null
          ? "border-grid-major bg-cell overflow-hidden rounded-2xl border-2"
          : "border-grid-major bg-cell aspect-square w-full overflow-hidden rounded-2xl border-2"
      }
    >
      {ROWS.map((row) => (
        <View key={row} className="flex-1 flex-row">
          {ROWS.map((col) => {
            const index = row * BOARD_SIZE + col;
            const value = game.values[index];
            const given = isGivenCell(game.givens, index);
            // Always flag rule-breaking duplicates; flag wrong-vs-solution only
            // when mistake checking is on. Givens are never shown as errors.
            const isError =
              !given &&
              value != null &&
              (hasDuplicate(game.values, index) ||
                (mistakeChecking && value !== Number(game.solution[index])));
            return (
              <SudokuCell
                key={index}
                index={index}
                value={value}
                notes={game.notes[index]}
                isGiven={given}
                isSelected={selectedCell === index}
                isPeer={highlightPeers && peers.has(index)}
                isSameValue={highlightSameNumbers && value != null && value === selectedValue}
                isConflict={isError}
                onPress={pressCell}
              />
            );
          })}
        </View>
      ))}
    </View>
  );
}
