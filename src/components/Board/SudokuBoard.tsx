import { useMemo } from "react";

import { getPeerIndices, isGivenCell } from "@/domain/sudoku/board";
import { computeConflicts } from "@/domain/sudoku/conflicts";
import { BOARD_SIZE } from "@/domain/sudoku/types";
import { useGameStore } from "@/state/useGameStore";
import { useSettingsStore } from "@/state/useSettingsStore";
import { View } from "@/tw";

import { SudokuCell } from "./SudokuCell";

const ROWS = Array.from({ length: BOARD_SIZE }, (_, i) => i);

// The 3x3 box boundaries fall one third and two thirds across the board. Drawn
// as a dedicated layer on top of the cells (centred 2px lines) so the major
// lines never get painted over by an adjacent cell's lighter border.
const BOX_FRACTIONS = [1 / 3, 2 / 3];
const MAJOR_LINE = 2;

function MajorGridLines() {
  return (
    <View pointerEvents="none" className="absolute inset-0">
      {BOX_FRACTIONS.map((fraction) => (
        <View
          key={`v-${fraction}`}
          className="bg-grid-major absolute top-0 bottom-0"
          style={{ left: `${fraction * 100}%`, width: MAJOR_LINE, marginLeft: -MAJOR_LINE / 2 }}
        />
      ))}
      {BOX_FRACTIONS.map((fraction) => (
        <View
          key={`h-${fraction}`}
          className="bg-grid-major absolute right-0 left-0"
          style={{ top: `${fraction * 100}%`, height: MAJOR_LINE, marginTop: -MAJOR_LINE / 2 }}
        />
      ))}
    </View>
  );
}

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
      <MajorGridLines />
    </View>
  );
}
