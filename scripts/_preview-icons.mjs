import { writeFileSync } from "node:fs";

// TEMPORARY scratch script to render logo candidates for review. Safe to delete.
import { Resvg } from "@resvg/resvg-js";

const BLUE = "#208AEF";
const BLUE_DEEP = "#0B6BD3";
const WHITE = "#FFFFFF";
const AMBER = "#FBBF24";

const S = 512;

// Geometry shared by all "tile + 3x3 cells" variants.
function geom(size) {
  const tile = size * 0.78;
  const t0 = (size - tile) / 2;
  const rx = tile * 0.235;
  const inset = tile * 0.15;
  const innerW = tile - inset * 2;
  const gapRatio = 0.16;
  const cell = innerW / (3 + 2 * gapRatio);
  const gap = cell * gapRatio;
  const step = cell + gap;
  const cx0 = t0 + inset;
  const cy0 = t0 + inset;
  const cr = cell * 0.22;
  return { tile, t0, rx, cell, step, cx0, cy0, cr };
}

function cellXY(g, row, col) {
  return { x: g.cx0 + col * g.step, y: g.cy0 + row * g.step };
}

// spec: 3x3 of "white" | "hole" | "accent" | "9" (blue numeral on white)
function render(name, { gradient = false, spec, accent = AMBER }) {
  const g = geom(S);
  const defs = gradient
    ? `<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${BLUE}"/><stop offset="1" stop-color="${BLUE_DEEP}"/></linearGradient></defs>`
    : "";
  const tileFill = gradient ? "url(#g)" : BLUE;
  let cells = "";
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3; col++) {
      const kind = spec[row][col];
      if (kind === "hole") continue;
      const { x, y } = cellXY(g, row, col);
      const fill = kind === "accent" ? accent : WHITE;
      cells += `<rect x="${x}" y="${y}" width="${g.cell}" height="${g.cell}" rx="${g.cr}" fill="${fill}"/>`;
      if (kind === "9") {
        cells += `<text x="${x + g.cell / 2}" y="${y + g.cell / 2}" dominant-baseline="central" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-weight="700" font-size="${g.cell * 0.82}" fill="${BLUE}">9</text>`;
      }
    }
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}" viewBox="0 0 ${S} ${S}">${defs}<rect width="${S}" height="${S}" fill="${WHITE}"/><rect x="${g.t0}" y="${g.t0}" width="${g.tile}" height="${g.tile}" rx="${g.rx}" fill="${tileFill}"/>${cells}</svg>`;
  const png = new Resvg(svg, {
    fitTo: { mode: "width", value: S },
    font: { loadSystemFonts: true, defaultFontFamily: "Helvetica" },
  })
    .render()
    .asPng();
  writeFileSync(`/tmp/icon-${name}.png`, png);
  console.log(`/tmp/icon-${name}.png`);
}

const W = "white";
const H = "hole";
const A = "accent";

// 1: single empty cell (the cell you solve) — center hole.
render("1-center-hole", {
  spec: [
    [W, W, W],
    [W, H, W],
    [W, W, W],
  ],
});
// 2: one amber accent cell (the active move).
render("2-amber-accent", {
  spec: [
    [W, W, W],
    [W, A, W],
    [W, W, W],
  ],
});
// 3: amber accent off-center (more dynamic).
render("3-amber-corner", {
  spec: [
    [W, W, A],
    [W, W, W],
    [W, W, W],
  ],
});
// 4: numeral in the center cell (D + E combined).
render("4-number-center", {
  spec: [
    [W, W, W],
    [W, "9", W],
    [W, W, W],
  ],
});
// 5: gradient tile + center hole (depth).
render("5-gradient-hole", {
  gradient: true,
  spec: [
    [W, W, W],
    [W, H, W],
    [W, W, W],
  ],
});
// 6: gradient + amber accent.
render("6-gradient-amber", {
  gradient: true,
  spec: [
    [W, W, W],
    [W, A, W],
    [W, W, W],
  ],
});
