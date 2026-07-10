// Build-time app icon generator.
//
// Renders the Sudoku brand mark — a rounded board with a 3x3 grid and a single
// highlighted (gold) cell — to the PNG asset set Expo expects, plus a master
// assets/logo.svg source. Run with: pnpm generate:icons
//
// Palette follows docs/DESIGN_GUIDELINES.md (§20.1, §24): cream tile, white
// board surface, indigo grid, one gold selected cell. The mark is defined once
// and parameterized per output so every asset stays visually identical.

import { copyFile, mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { Resvg } from "@resvg/resvg-js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const IMAGES_DIR = resolve(__dirname, "../assets/images");
const ASSETS_DIR = resolve(__dirname, "../assets");
const STORE_DIR = resolve(__dirname, "../assets/store");
const WEBSITE_DIR = resolve(__dirname, "../website");

const CREAM = "#F7F3EA"; // background tile / app surface
const WHITE = "#FFFFFF"; // board surface
const INDIGO = "#2F3A5F"; // grid lines + frame (primary)
const GOLD = "#DDBB72"; // highlighted cell (cellSelected)
const BLACK = "#000000"; // android monochrome silhouette
const MUTED = "#5C657A"; // secondary text on cream

// Which cell is highlighted, as [row, col] in the 3x3 grid. Top-right.
const HIGHLIGHT = [0, 2];

/**
 * Build an SVG string for the brand mark.
 * @param {object} o
 * @param {number} o.size           square canvas size
 * @param {string|null} o.bg        tile background fill, or null for transparent
 * @param {string|null} o.board     board surface fill, or null for transparent
 * @param {string} o.line           grid line color
 * @param {string} o.cell           highlighted cell fill
 * @param {string} o.frame          board outline color
 * @param {number} o.heightRatio    board size as a fraction of the canvas
 */
function buildSvg({ size, bg, board, line, cell, frame, heightRatio }) {
  const boardSize = size * heightRatio;
  const x0 = (size - boardSize) / 2;
  const y0 = (size - boardSize) / 2;
  const cellSize = boardSize / 3;
  const radius = boardSize * 0.1;
  const lineW = boardSize * 0.022;
  const frameW = boardSize * 0.03;
  const [hr, hc] = HIGHLIGHT;

  const f = (n) => n.toFixed(2);
  // Reusable board rect prefix (no closing bracket — callers append attrs).
  const boardRect = `<rect x="${f(x0)}" y="${f(y0)}" width="${f(boardSize)}" height="${f(boardSize)}" rx="${f(radius)}"`;
  const clipId = `clip${size}`;

  const parts = [];
  if (bg) {
    parts.push(`<rect width="${size}" height="${size}" fill="${bg}"/>`);
  }
  parts.push(`<defs><clipPath id="${clipId}">${boardRect} /></clipPath></defs>`);
  if (board) {
    parts.push(`${boardRect} fill="${board}"/>`);
  }

  // Highlighted cell, clipped so it respects the board's rounded corners.
  const cx = x0 + hc * cellSize;
  const cy = y0 + hr * cellSize;
  parts.push(
    `<g clip-path="url(#${clipId})"><rect x="${f(cx)}" y="${f(cy)}" width="${f(cellSize)}" height="${f(cellSize)}" fill="${cell}"/></g>`,
  );

  // Internal 3x3 grid lines (clipped to the board).
  const lines = [];
  for (let i = 1; i < 3; i++) {
    const x = x0 + i * cellSize;
    const y = y0 + i * cellSize;
    lines.push(
      `<line x1="${f(x)}" y1="${f(y0)}" x2="${f(x)}" y2="${f(y0 + boardSize)}" stroke="${line}" stroke-width="${f(lineW)}"/>`,
    );
    lines.push(
      `<line x1="${f(x0)}" y1="${f(y)}" x2="${f(x0 + boardSize)}" y2="${f(y)}" stroke="${line}" stroke-width="${f(lineW)}"/>`,
    );
  }
  parts.push(`<g clip-path="url(#${clipId})">${lines.join("")}</g>`);

  // Outer frame on top so the board edge stays crisp over the fill and lines.
  parts.push(`${boardRect} fill="none" stroke="${frame}" stroke-width="${f(frameW)}"/>`);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${parts.join("")}</svg>`;
}

/**
 * Social share card (1200×630). Content is centered so WhatsApp/iMessage
 * square crops still show the icon + title instead of empty padding.
 */
function buildOgSvg() {
  const w = 1200;
  const h = 630;
  const iconSize = 280;
  const iconX = (w - iconSize) / 2;
  const iconY = 96;
  const boardSize = iconSize * 0.72;
  const bx = iconX + (iconSize - boardSize) / 2;
  const by = iconY + (iconSize - boardSize) / 2;
  const cell = boardSize / 3;
  const radius = boardSize * 0.1;
  const lineW = boardSize * 0.022;
  const frameW = boardSize * 0.03;
  const iconRadius = iconSize * 0.2237; // iOS-ish squircle approximation
  const [hr, hc] = HIGHLIGHT;
  const f = (n) => n.toFixed(2);
  const clipId = "ogClip";

  const boardRect = `<rect x="${f(bx)}" y="${f(by)}" width="${f(boardSize)}" height="${f(boardSize)}" rx="${f(radius)}"`;
  const lines = [];
  for (let i = 1; i < 3; i++) {
    const x = bx + i * cell;
    const y = by + i * cell;
    lines.push(
      `<line x1="${f(x)}" y1="${f(by)}" x2="${f(x)}" y2="${f(by + boardSize)}" stroke="${INDIGO}" stroke-width="${f(lineW)}"/>`,
    );
    lines.push(
      `<line x1="${f(bx)}" y1="${f(y)}" x2="${f(bx + boardSize)}" y2="${f(y)}" stroke="${INDIGO}" stroke-width="${f(lineW)}"/>`,
    );
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <rect width="${w}" height="${h}" fill="${CREAM}"/>
  <rect x="${f(iconX)}" y="${f(iconY)}" width="${iconSize}" height="${iconSize}" rx="${f(iconRadius)}" fill="${CREAM}" stroke="${INDIGO}" stroke-width="3"/>
  <defs><clipPath id="${clipId}">${boardRect} /></clipPath></defs>
  ${boardRect} fill="${WHITE}"/>
  <g clip-path="url(#${clipId})">
    <rect x="${f(bx + hc * cell)}" y="${f(by + hr * cell)}" width="${f(cell)}" height="${f(cell)}" fill="${GOLD}"/>
    ${lines.join("")}
  </g>
  ${boardRect} fill="none" stroke="${INDIGO}" stroke-width="${f(frameW)}"/>
  <text x="600" y="460" text-anchor="middle" font-family="ui-rounded, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" font-size="64" font-weight="700" fill="${INDIGO}">Offline Sudoku</text>
  <text x="600" y="520" text-anchor="middle" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" font-size="32" font-weight="500" fill="${MUTED}">Classic puzzles. Works offline.</text>
</svg>`;
}

function renderPng(svg, width) {
  return new Resvg(svg, { fitTo: { mode: "width", value: width } }).render().asPng();
}

async function main() {
  await mkdir(IMAGES_DIR, { recursive: true });
  await mkdir(STORE_DIR, { recursive: true });
  await mkdir(WEBSITE_DIR, { recursive: true });

  // Master vector source: cream tile, white board, indigo grid, gold cell.
  const masterSvg = buildSvg({
    size: 1024,
    bg: CREAM,
    board: WHITE,
    line: INDIGO,
    cell: GOLD,
    frame: INDIGO,
    heightRatio: 0.62,
  });
  await writeFile(resolve(ASSETS_DIR, "logo.svg"), `${masterSvg}\n`, "utf8");

  const outputs = [
    // App icon: full cream tile with the white board mark.
    { file: `${IMAGES_DIR}/icon.png`, width: 1024, svg: masterSvg },
    // App Store Connect IAP image (1024x1024, optional) for "Remove Ads".
    { file: `${STORE_DIR}/remove-ads-iap.png`, width: 1024, svg: masterSvg },
    // Web favicon: same mark, board slightly larger so it reads when tiny.
    {
      file: `${IMAGES_DIR}/favicon.png`,
      width: 196,
      svg: buildSvg({
        size: 196,
        bg: CREAM,
        board: WHITE,
        line: INDIGO,
        cell: GOLD,
        frame: INDIGO,
        heightRatio: 0.72,
      }),
    },
    // Android adaptive foreground: transparent, mark kept inside the safe zone.
    {
      file: `${IMAGES_DIR}/android-icon-foreground.png`,
      width: 1024,
      svg: buildSvg({
        size: 1024,
        bg: null,
        board: WHITE,
        line: INDIGO,
        cell: GOLD,
        frame: INDIGO,
        heightRatio: 0.46,
      }),
    },
    // Android monochrome (themed icons): single-color silhouette on transparent.
    {
      file: `${IMAGES_DIR}/android-icon-monochrome.png`,
      width: 1024,
      svg: buildSvg({
        size: 1024,
        bg: null,
        board: null,
        line: BLACK,
        cell: BLACK,
        frame: BLACK,
        heightRatio: 0.46,
      }),
    },
    // Splash mark: white board mark on transparent (splash background is indigo).
    {
      file: `${IMAGES_DIR}/splash-icon.png`,
      width: 512,
      svg: buildSvg({
        size: 512,
        bg: null,
        board: WHITE,
        line: INDIGO,
        cell: GOLD,
        frame: INDIGO,
        heightRatio: 0.66,
      }),
    },
  ];

  await Promise.all(outputs.map(({ file, width, svg }) => writeFile(file, renderPng(svg, width))));

  const ogSvg = buildOgSvg();
  const ogPath = resolve(WEBSITE_DIR, "og.png");
  await writeFile(ogPath, renderPng(ogSvg, 1200));

  await copyFile(resolve(IMAGES_DIR, "favicon.png"), resolve(WEBSITE_DIR, "favicon.png"));

  for (const { file, width } of outputs) {
    console.log(`${file.replace(`${ASSETS_DIR}/`, "")}  (${width}px)`);
  }
  console.log(`website/og.png  (1200×630)`);
  console.log(`website/favicon.png  (196px)`);

  console.log("Done -> assets/logo.svg + assets/images/*.png + website/og.png");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
