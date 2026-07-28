import { getPeerIndices, isGivenCell } from "./board";
import { CELL_COUNT, type CellValue } from "./types";

/** Digits 1-9 that don't currently conflict with a peer at `index`. */
export function computeCandidates(values: CellValue[], index: number): number[] {
  if (values[index] != null) {
    return [];
  }
  const used = new Set<number>();
  for (const peer of getPeerIndices(index)) {
    const v = values[peer];
    if (v != null) {
      used.add(v);
    }
  }
  const candidates: number[] = [];
  for (let n = 1; n <= 9; n++) {
    if (!used.has(n)) {
      candidates.push(n);
    }
  }
  return candidates;
}

/**
 * Cooldown between hints, in milliseconds. Stops players from spamming the Hint
 * button (which would trivialize the puzzle) — applies to every reveal, premium
 * included. See docs/HINT_FLOW.md.
 */
export const HINT_COOLDOWN_MS = 30_000;

export type HintStrategy = "naked_single" | "candidate_choice" | "conflicting_entries";

export type Hint = {
  index: number;
  value: number;
  candidates: number[];
  strategy: HintStrategy;
};

export type HintExplanation = {
  title: string;
  body: string;
  announcement: string;
};

/**
 * Choose a cell to reveal: prefer a genuine naked single, otherwise the cell
 * with the fewest candidates that still includes its solution value. If a
 * wrong peer entry has eliminated the solution value, fall back to one of those
 * cells and describe the nearby conflict honestly. Returns null when nothing
 * remains to reveal.
 */
export function findHintCell(values: CellValue[], givens: string, solution: string): Hint | null {
  let bestChoice: Hint | null = null;
  let conflictingFallback: Hint | null = null;
  for (let i = 0; i < CELL_COUNT; i++) {
    if (values[i] != null || isGivenCell(givens, i)) {
      continue;
    }
    const value = Number(solution[i]);
    const candidates = computeCandidates(values, i);
    if (candidates.length === 1 && candidates[0] === value) {
      return { index: i, value, candidates, strategy: "naked_single" };
    }
    if (candidates.includes(value)) {
      if (!bestChoice || candidates.length < bestChoice.candidates.length) {
        bestChoice = { index: i, value, candidates, strategy: "candidate_choice" };
      }
    } else if (!conflictingFallback) {
      conflictingFallback = {
        index: i,
        value,
        candidates,
        strategy: "conflicting_entries",
      };
    }
  }
  return bestChoice ?? conflictingFallback;
}

/** Human-readable teaching copy for the post-reveal explanation card. */
export function describeHint(hint: Hint): HintExplanation {
  const row = Math.floor(hint.index / 9) + 1;
  const column = (hint.index % 9) + 1;
  const cell = `Row ${row}, column ${column}`;

  if (hint.strategy === "naked_single") {
    return {
      title: `Only ${hint.value} fits`,
      body: `${cell} has no other valid candidate after checking its row, column, and 3×3 box.`,
      announcement: `${cell}. Only ${hint.value} fits.`,
    };
  }

  if (hint.strategy === "conflicting_entries") {
    return {
      title: "Check nearby entries",
      body: `An entry in the highlighted row, column, or box is blocking the correct candidate. ${cell} should be ${hint.value}.`,
      announcement: `${cell} should be ${hint.value}. Check nearby entries for a conflict.`,
    };
  }

  return {
    title: "Narrowing the candidates",
    body: `${cell} had ${formatCandidateList(hint.candidates)} remaining. This hint reveals ${hint.value}.`,
    announcement: `${cell}. The remaining candidates were ${hint.candidates.join(", ")}. The hint reveals ${hint.value}.`,
  };
}

function formatCandidateList(candidates: number[]): string {
  if (candidates.length <= 1) {
    return String(candidates[0] ?? "no candidates");
  }
  if (candidates.length === 2) {
    return `${candidates[0]} and ${candidates[1]}`;
  }
  return `${candidates.slice(0, -1).join(", ")}, and ${candidates[candidates.length - 1]}`;
}
