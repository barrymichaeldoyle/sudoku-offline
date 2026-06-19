import type { Difficulty } from "@/domain/sudoku/types";

import challengePack from "@/assets/puzzles/challenge.json";
import dailyPack from "@/assets/puzzles/daily.json";
import easyPack from "@/assets/puzzles/easy.json";
import expertPack from "@/assets/puzzles/expert.json";
import hardPack from "@/assets/puzzles/hard.json";
import mediumPack from "@/assets/puzzles/medium.json";

export type BundledPuzzle = {
  id: string;
  difficulty: Difficulty;
  givens: string;
  solution: string;
};

export type BundledPack = {
  /** Stable pack identifier, also the puzzle_packs primary key. */
  id: string;
  /** Bump when regenerating a pack to trigger re-import on next launch. */
  version: number;
  /** True for the rotating daily pool (selected by date index, not difficulty). */
  daily: boolean;
  puzzles: BundledPuzzle[];
};

export const PACK_VERSION = 2;

export const BUNDLED_PACKS: readonly BundledPack[] = [
  { id: "easy", version: PACK_VERSION, daily: false, puzzles: easyPack as BundledPuzzle[] },
  { id: "medium", version: PACK_VERSION, daily: false, puzzles: mediumPack as BundledPuzzle[] },
  { id: "hard", version: PACK_VERSION, daily: false, puzzles: hardPack as BundledPuzzle[] },
  { id: "expert", version: PACK_VERSION, daily: false, puzzles: expertPack as BundledPuzzle[] },
  { id: "daily", version: PACK_VERSION, daily: true, puzzles: dailyPack as BundledPuzzle[] },
  {
    id: "challenge",
    version: PACK_VERSION,
    daily: true,
    puzzles: challengePack as BundledPuzzle[],
  },
];
