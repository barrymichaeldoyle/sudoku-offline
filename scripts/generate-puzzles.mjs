// Build-time Sudoku puzzle generator.
//
// Generates puzzle packs (JSON arrays of { id, difficulty, givens, solution })
// for each difficulty plus a daily pool, and writes them to src/assets/puzzles/.
// This runs only at build/author time — no generator ships in the app bundle.
//
// Output is deterministic for a given SEED so regenerating produces stable diffs.
//
// Usage: pnpm generate:puzzles   (or: node scripts/generate-puzzles.mjs)

import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = resolve(__dirname, "../assets/puzzles");

const SEED = Number(process.env.PUZZLE_SEED ?? 0x5eed1234);

// Approximate difficulty by number of clues (givens). Lower clues => harder.
const CONFIG = {
  easy: { count: 60, minClues: 40, maxClues: 45 },
  medium: { count: 60, minClues: 33, maxClues: 38 },
  hard: { count: 50, minClues: 28, maxClues: 32 },
  expert: { count: 40, minClues: 24, maxClues: 27 },
};
// Daily pool: a single rotating set selected by date index in the app.
const DAILY = { count: 120, difficulty: "medium", minClues: 33, maxClues: 38 };
// Challenge pool: a second daily track of extreme puzzles (very few clues), for
// the optional "Daily Challenge". Harder than expert and hint-friendly.
const CHALLENGE = {
  count: 120,
  difficulty: "extreme",
  minClues: 22,
  maxClues: 25,
  symmetric: false,
};

// --- Seedable PRNG (mulberry32) ---------------------------------------------
function makeRng(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle(arr, rng) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// --- Solver core ------------------------------------------------------------
const ROW = new Uint8Array(81);
const COL = new Uint8Array(81);
const BOX = new Uint8Array(81);
for (let i = 0; i < 81; i++) {
  ROW[i] = Math.floor(i / 9);
  COL[i] = i % 9;
  BOX[i] = Math.floor(ROW[i] / 3) * 3 + Math.floor(COL[i] / 3);
}

// Candidate bitmask (bits 0-8 => digits 1-9) available at `idx`.
function candidateMask(grid, idx) {
  let used = 0;
  const r = ROW[idx];
  const c = COL[idx];
  const b = BOX[idx];
  for (let k = 0; k < 81; k++) {
    const v = grid[k];
    if (v && (ROW[k] === r || COL[k] === c || BOX[k] === b)) {
      used |= 1 << (v - 1);
    }
  }
  return ~used & 0x1ff;
}

// Find the empty cell with the fewest candidates (MRV heuristic).
function findBestEmpty(grid) {
  let best = -1;
  let bestMask = 0;
  let bestCount = 10;
  for (let i = 0; i < 81; i++) {
    if (grid[i] !== 0) continue;
    const mask = candidateMask(grid, i);
    const count = bitCount(mask);
    if (count < bestCount) {
      best = i;
      bestMask = mask;
      bestCount = count;
      if (count <= 1) break;
    }
  }
  return { idx: best, mask: bestMask, count: bestCount };
}

function bitCount(mask) {
  let n = 0;
  while (mask) {
    mask &= mask - 1;
    n++;
  }
  return n;
}

function maskToDigits(mask) {
  const digits = [];
  for (let d = 1; d <= 9; d++) {
    if (mask & (1 << (d - 1))) digits.push(d);
  }
  return digits;
}

// Fill an empty grid with a random complete solution.
function fillGrid(grid, rng) {
  const { idx, mask, count } = findBestEmpty(grid);
  if (idx === -1) return true; // solved
  if (count === 0) return false;
  for (const d of shuffle(maskToDigits(mask), rng)) {
    grid[idx] = d;
    if (fillGrid(grid, rng)) return true;
    grid[idx] = 0;
  }
  return false;
}

// Count solutions up to `limit` (used to verify uniqueness).
function countSolutions(grid, limit) {
  const { idx, mask, count } = findBestEmpty(grid);
  if (idx === -1) return 1;
  if (count === 0) return 0;
  let total = 0;
  for (const d of maskToDigits(mask)) {
    grid[idx] = d;
    total += countSolutions(grid, limit);
    grid[idx] = 0;
    if (total >= limit) break;
  }
  return total;
}

// --- Puzzle construction ----------------------------------------------------
function generateSolution(rng) {
  const grid = new Uint8Array(81);
  fillGrid(grid, rng);
  return grid;
}

// Dig holes from a solved grid while keeping the solution unique. Central
// symmetry (remove cell + its mirror together) gives a cleaner look but can't
// reach very low clue counts; the extreme/challenge pool digs asymmetrically
// (`symmetric: false`) so it can strip down to genuinely hard puzzles.
function digPuzzle(solution, minClues, maxClues, rng, symmetric = true) {
  const puzzle = Uint8Array.from(solution);
  const targetClues = minClues + Math.floor(rng() * (maxClues - minClues + 1));
  let clues = 81;

  const positions = shuffle(
    Array.from({ length: 81 }, (_, i) => i),
    rng,
  );

  for (const pos of positions) {
    if (clues <= targetClues) break;
    const mirror = 80 - pos;
    const cells = symmetric && pos !== mirror ? [pos, mirror] : [pos];
    if (cells.some((c) => puzzle[c] === 0)) continue;

    const removed = cells.map((c) => puzzle[c]);
    for (const c of cells) puzzle[c] = 0;

    if (countSolutions(Uint8Array.from(puzzle), 2) === 1) {
      clues -= cells.length;
    } else {
      cells.forEach((c, i) => {
        puzzle[c] = removed[i];
      });
    }
  }

  return puzzle;
}

function gridToString(grid) {
  let s = "";
  for (let i = 0; i < 81; i++) s += String(grid[i]);
  return s;
}

// --- Validation (mirrors src/domain/sudoku/validation.ts) -------------------
function isSolvedGrid(solution) {
  if (!/^[1-9]{81}$/.test(solution)) return false;
  const rows = Array.from({ length: 9 }, () => 0);
  const cols = Array.from({ length: 9 }, () => 0);
  const boxes = Array.from({ length: 9 }, () => 0);
  for (let i = 0; i < 81; i++) {
    const bit = 1 << (solution.charCodeAt(i) - 49);
    if (rows[ROW[i]] & bit || cols[COL[i]] & bit || boxes[BOX[i]] & bit) return false;
    rows[ROW[i]] |= bit;
    cols[COL[i]] |= bit;
    boxes[BOX[i]] |= bit;
  }
  return true;
}

function validate(givens, solution) {
  if (givens.length !== 81 || !/^[0-9]{81}$/.test(givens)) return "givens malformed";
  if (!isSolvedGrid(solution)) return "solution not a solved grid";
  for (let i = 0; i < 81; i++) {
    if (givens[i] !== "0" && givens[i] !== solution[i]) return "givens contradict solution";
  }
  if (countSolutions(parseGrid(givens), 2) !== 1) return "puzzle has no unique solution";
  return null;
}

function parseGrid(str) {
  const g = new Uint8Array(81);
  for (let i = 0; i < 81; i++) g[i] = str.charCodeAt(i) - 48;
  return g;
}

// --- Pack generation --------------------------------------------------------
function pad(n) {
  return String(n).padStart(6, "0");
}

function buildPack({ difficulty, count, minClues, maxClues, idPrefix, symmetric = true }, rng) {
  const puzzles = [];
  const seen = new Set();
  let attempts = 0;
  while (puzzles.length < count) {
    attempts++;
    if (attempts > count * 50) {
      throw new Error(`Could not generate ${count} ${idPrefix} puzzles (got ${puzzles.length})`);
    }
    const solution = generateSolution(rng);
    const puzzle = digPuzzle(solution, minClues, maxClues, rng, symmetric);
    const givens = gridToString(puzzle);
    if (seen.has(givens)) continue;

    const solutionStr = gridToString(solution);
    const error = validate(givens, solutionStr);
    if (error) continue;

    seen.add(givens);
    puzzles.push({
      id: `${idPrefix}_${pad(puzzles.length + 1)}`,
      difficulty,
      givens,
      solution: solutionStr,
    });
  }
  return puzzles;
}

async function main() {
  const startedAt = Date.now();
  await mkdir(OUT_DIR, { recursive: true });

  // Independent RNG streams per pack so adding/changing one pack doesn't shift
  // the others' output.
  const packs = [
    { file: "easy.json", difficulty: "easy", idPrefix: "puzzle_easy", ...CONFIG.easy },
    { file: "medium.json", difficulty: "medium", idPrefix: "puzzle_medium", ...CONFIG.medium },
    { file: "hard.json", difficulty: "hard", idPrefix: "puzzle_hard", ...CONFIG.hard },
    { file: "expert.json", difficulty: "expert", idPrefix: "puzzle_expert", ...CONFIG.expert },
    { file: "daily.json", difficulty: DAILY.difficulty, idPrefix: "daily", ...DAILY },
    {
      file: "challenge.json",
      difficulty: CHALLENGE.difficulty,
      idPrefix: "challenge",
      ...CHALLENGE,
    },
  ];

  const results = packs.map((pack, seedOffset) => {
    const rng = makeRng(SEED + seedOffset * 0x9e3779b1);
    const t0 = Date.now();
    const puzzles = buildPack(pack, rng);
    const clueCounts = puzzles.map((p) => p.givens.replace(/0/g, "").length);
    const min = Math.min(...clueCounts);
    const max = Math.max(...clueCounts);
    return { pack, puzzles, min, max, elapsedMs: Date.now() - t0 };
  });

  await Promise.all(
    results.map(({ pack, puzzles }) =>
      writeFile(resolve(OUT_DIR, pack.file), `${JSON.stringify(puzzles, null, 0)}\n`, "utf8"),
    ),
  );

  for (const { pack, puzzles, min, max, elapsedMs } of results) {
    console.log(
      `${pack.file.padEnd(12)} ${String(puzzles.length).padStart(3)} puzzles  clues ${min}-${max}  (${elapsedMs}ms)`,
    );
  }

  console.log(`Done in ${((Date.now() - startedAt) / 1000).toFixed(1)}s -> ${OUT_DIR}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
