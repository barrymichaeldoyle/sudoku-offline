import { useMemo } from "react";

import { getPeerIndices, isGivenCell } from "@/domain/sudoku/board";
import { computeConflicts } from "@/domain/sudoku/conflicts";
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

  const conflicts = useMemo(
    () =>
      game ? computeConflicts(game.values, game.givens, game.solution, mistakeChecking) : null,
    [game, mistakeChecking],
  );

  if (!game) {
    return null;
  }

  const selectedValue = selectedCell == null ? null : game.values[selectedCell];

  // Scale the digit/note type to the cell so big boards (e.g. iPad) don't show
  // small numbers in large cells. Floored at the phone defaults so small screens
  // are unchanged. Undefined when unmeasured (cells fall back to fixed sizes).
  const cellSize = size != null ? size / BOARD_SIZE : null;
  const fontSize = cellSize != null ? Math.max(24, Math.round(cellSize * 0.5)) : undefined;
  const noteFontSize = cellSize != null ? Math.max(10, Math.round(cellSize * 0.2)) : undefined;

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
                isConflict={conflicts?.[index] ?? false}
                onPress={pressCell}
                fontSize={fontSize}
                noteFontSize={noteFontSize}
              />
            );
          })}
        </View>
      ))}
    </View>
  );
}
