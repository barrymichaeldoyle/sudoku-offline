import { BOARD_SIZE, BOX_SIZE, CELL_COUNT, type CellValue } from "./types";

/**
 * Board index convention (row-major, 0-80):
 *   0  1  2  | 3  4  5  | 6  7  8
 *   9  10 11 | 12 13 14 | 15 16 17
 *   ...
 *                          80
 */

export function getRowIndex(cellIndex: number): number {
  return Math.floor(cellIndex / BOARD_SIZE);
}

export function getColIndex(cellIndex: number): number {
  return cellIndex % BOARD_SIZE;
}

export function getBoxIndex(cellIndex: number): number {
  const boxRow = Math.floor(getRowIndex(cellIndex) / BOX_SIZE);
  const boxCol = Math.floor(getColIndex(cellIndex) / BOX_SIZE);
  return boxRow * BOX_SIZE + boxCol;
}

// Peer indices are static per cell, so compute them once and cache.
const PEER_CACHE: number[][] = (() => {
  const cache: number[][] = [];
  for (let cellIndex = 0; cellIndex < CELL_COUNT; cellIndex++) {
    const row = getRowIndex(cellIndex);
    const col = getColIndex(cellIndex);
    const boxRowStart = Math.floor(row / BOX_SIZE) * BOX_SIZE;
    const boxColStart = Math.floor(col / BOX_SIZE) * BOX_SIZE;
    const peers = new Set<number>();

    for (let k = 0; k < BOARD_SIZE; k++) {
      peers.add(row * BOARD_SIZE + k); // same row
      peers.add(k * BOARD_SIZE + col); // same column
    }
    for (let r = 0; r < BOX_SIZE; r++) {
      for (let c = 0; c < BOX_SIZE; c++) {
        peers.add((boxRowStart + r) * BOARD_SIZE + (boxColStart + c)); // same box
      }
    }

    peers.delete(cellIndex);
    cache.push([...peers].sort((a, b) => a - b));
  }
  return cache;
})();

/** All cells that share a row, column, or box with `cellIndex` (excluding itself). */
export function getPeerIndices(cellIndex: number): number[] {
  return PEER_CACHE[cellIndex];
}

// Box-only peers: the eight other cells in the same 3x3 box. Cached like above.
const BOX_PEER_CACHE: number[][] = (() => {
  const cache: number[][] = [];
  for (let cellIndex = 0; cellIndex < CELL_COUNT; cellIndex++) {
    const boxRowStart = Math.floor(getRowIndex(cellIndex) / BOX_SIZE) * BOX_SIZE;
    const boxColStart = Math.floor(getColIndex(cellIndex) / BOX_SIZE) * BOX_SIZE;
    const peers: number[] = [];
    for (let r = 0; r < BOX_SIZE; r++) {
      for (let c = 0; c < BOX_SIZE; c++) {
        const peer = (boxRowStart + r) * BOARD_SIZE + (boxColStart + c);
        if (peer !== cellIndex) {
          peers.push(peer);
        }
      }
    }
    cache.push(peers);
  }
  return cache;
})();

/** The eight other cells sharing the same 3x3 box as `cellIndex` (excluding itself). */
export function getBoxPeerIndices(cellIndex: number): number[] {
  return BOX_PEER_CACHE[cellIndex];
}

export function parseValuesString(input: string): CellValue[] {
  const values: CellValue[] = Array.from({ length: CELL_COUNT });
  for (let i = 0; i < CELL_COUNT; i++) {
    const ch = input[i];
    const digit = ch ? ch.charCodeAt(0) - 48 : 0;
    values[i] = digit >= 1 && digit <= 9 ? digit : null;
  }
  return values;
}

export function valuesToString(values: CellValue[]): string {
  let out = "";
  for (let i = 0; i < CELL_COUNT; i++) {
    const v = values[i];
    out += v && v >= 1 && v <= 9 ? String(v) : "0";
  }
  return out;
}

export function isGivenCell(givens: string, cellIndex: number): boolean {
  const ch = givens[cellIndex];
  return ch !== undefined && ch !== "0";
}

export function isValueCorrect(solution: string, cellIndex: number, value: number): boolean {
  return solution[cellIndex] === String(value);
}

/**
 * True when the value at `cellIndex` collides with the same value in any peer.
 * Empty cells never count as duplicates.
 */
export function hasDuplicate(values: CellValue[], cellIndex: number): boolean {
  const value = values[cellIndex];
  if (value == null) {
    return false;
  }
  for (const peer of getPeerIndices(cellIndex)) {
    if (values[peer] === value) {
      return true;
    }
  }
  return false;
}

/** True when every cell is filled and matches the solution string. */
export function isPuzzleComplete(values: CellValue[], solution: string): boolean {
  for (let i = 0; i < CELL_COUNT; i++) {
    const v = values[i];
    if (v == null || String(v) !== solution[i]) {
      return false;
    }
  }
  return true;
}
