// Build-time app icon generator.
//
// Renders the Sudoku "S-grid" monogram (an S spelled out by filled Sudoku cells)
// to the PNG asset set Expo expects, plus a master assets/logo.svg source.
// Run with: pnpm generate:icons
//
// The mark is defined once as a 3x5 cell grid; colors/sizes are parameterized
// per output so every asset stays visually identical.

import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { Resvg } from "@resvg/resvg-js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const IMAGES_DIR = resolve(__dirname, "../assets/images");
const ASSETS_DIR = resolve(__dirname, "../assets");

const BLUE = "#208AEF";
const WHITE = "#FFFFFF";
const EMPTY_STROKE = "#CBD5E1";

// 1 = filled cell, 0 = empty cell. Reads as the letter "S".
const PATTERN = [
  [1, 1, 1],
  [1, 0, 0],
  [1, 1, 1],
  [0, 0, 1],
  [1, 1, 1],
];
const COLS = 3;
const ROWS = 5;

/**
 * Build an SVG string for the monogram.
 * @param {object} o
 * @param {number} o.size          square canvas size
 * @param {string|null} o.bg       background fill, or null for transparent
 * @param {string} o.fill          filled-cell color
 * @param {string|null} o.stroke   empty-cell outline color, or null to hide them
 * @param {number} o.heightRatio   mark height as a fraction of the canvas
 */
function buildSvg({ size, bg, fill, stroke, heightRatio }) {
  const markHeight = size * heightRatio;
  const gapRatio = 0.16;
  const cell = markHeight / (ROWS + (ROWS - 1) * gapRatio);
  const gap = cell * gapRatio;
  const step = cell + gap;
  const markWidth = COLS * cell + (COLS - 1) * gap;
  const x0 = (size - markWidth) / 2;
  const y0 = (size - markHeight) / 2;
  const r = cell * 0.16;

  const rects = [];
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const x = x0 + col * step;
      const y = y0 + row * step;
      if (PATTERN[row][col]) {
        rects.push(
          `<rect x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${cell.toFixed(2)}" height="${cell.toFixed(2)}" rx="${r.toFixed(2)}" fill="${fill}"/>`,
        );
      } else if (stroke) {
        rects.push(
          `<rect x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${cell.toFixed(2)}" height="${cell.toFixed(2)}" rx="${r.toFixed(2)}" fill="none" stroke="${stroke}" stroke-width="${(cell * 0.06).toFixed(2)}"/>`,
        );
      }
    }
  }

  const background = bg ? `<rect width="${size}" height="${size}" fill="${bg}"/>` : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${background}${rects.join("")}</svg>`;
}

function renderPng(svg, width) {
  return new Resvg(svg, { fitTo: { mode: "width", value: width } }).render().asPng();
}

async function main() {
  await mkdir(IMAGES_DIR, { recursive: true });

  // Master vector source (blue on white, with faint empty cells).
  const masterSvg = buildSvg({
    size: 1024,
    bg: WHITE,
    fill: BLUE,
    stroke: EMPTY_STROKE,
    heightRatio: 0.66,
  });
  await writeFile(resolve(ASSETS_DIR, "logo.svg"), `${masterSvg}\n`, "utf8");

  const outputs = [
    // App icon: full white tile, blue S with faint empty cells.
    { file: `${IMAGES_DIR}/icon.png`, width: 1024, svg: masterSvg },
    // Web favicon: blue S on white, no faint cells (too small to read).
    {
      file: `${IMAGES_DIR}/favicon.png`,
      width: 196,
      svg: buildSvg({ size: 196, bg: WHITE, fill: BLUE, stroke: null, heightRatio: 0.72 }),
    },
    // Android adaptive foreground: transparent, mark kept inside the safe zone.
    {
      file: `${IMAGES_DIR}/android-icon-foreground.png`,
      width: 1024,
      svg: buildSvg({ size: 1024, bg: null, fill: BLUE, stroke: null, heightRatio: 0.5 }),
    },
    // Android monochrome (themed icons): single-color silhouette on transparent.
    {
      file: `${IMAGES_DIR}/android-icon-monochrome.png`,
      width: 1024,
      svg: buildSvg({ size: 1024, bg: null, fill: "#000000", stroke: null, heightRatio: 0.5 }),
    },
    // Splash mark: white S on transparent (splash background is blue).
    {
      file: `${IMAGES_DIR}/splash-icon.png`,
      width: 512,
      svg: buildSvg({ size: 512, bg: null, fill: WHITE, stroke: null, heightRatio: 0.8 }),
    },
  ];

  for (const { file, width, svg } of outputs) {
    await writeFile(file, renderPng(svg, width));
    console.log(`${file.replace(`${ASSETS_DIR}/`, "")}  (${width}px)`);
  }

  console.log("Done -> assets/logo.svg + assets/images/*.png");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
