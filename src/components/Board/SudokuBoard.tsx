import { useMemo } from "react";

import { getPeerIndices, isGivenCell } from "@/domain/sudoku/board";
import { BOARD_SIZE, CELL_COUNT, type CellValue } from "@/domain/sudoku/types";
import { useGameStore } from "@/state/useGameStore";
import { useSettingsStore } from "@/state/useSettingsStore";
import { View } from "@/tw";

import { SudokuCell } from "./SudokuCell";

const ROWS = Array.from({ length: BOARD_SIZE }, (_, i) => i);

function getBoxIndex(row: number, col: number): number {
  return Math.floor(row / 3) * 3 + Math.floor(col / 3);
}

function computeConflicts(
  values: CellValue[],
  givens: string,
  solution: string,
  mistakeChecking: boolean,
): boolean[] {
  const rows = Array.from({ length: BOARD_SIZE }, () => Array<number>(BOARD_SIZE + 1).fill(0));
  const cols = Array.from({ length: BOARD_SIZE }, () => Array<number>(BOARD_SIZE + 1).fill(0));
  const boxes = Array.from({ length: BOARD_SIZE }, () => Array<number>(BOARD_SIZE + 1).fill(0));

  for (let index = 0; index < CELL_COUNT; index++) {
    const value = values[index];
    if (value == null) {
      continue;
    }
    const row = Math.floor(index / BOARD_SIZE);
    const col = index % BOARD_SIZE;
    const box = getBoxIndex(row, col);
    rows[row][value] += 1;
    cols[col][value] += 1;
    boxes[box][value] += 1;
  }

  const conflicts = Array<boolean>(CELL_COUNT).fill(false);
  for (let index = 0; index < CELL_COUNT; index++) {
    const value = values[index];
    if (value == null || isGivenCell(givens, index)) {
      continue;
    }
    const row = Math.floor(index / BOARD_SIZE);
    const col = index % BOARD_SIZE;
    const box = getBoxIndex(row, col);
    conflicts[index] =
      rows[row][value] > 1 ||
      cols[col][value] > 1 ||
      boxes[box][value] > 1 ||
      (mistakeChecking && value !== Number(solution[index]));
  }
  return conflicts;
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
    </View>
  );
}
