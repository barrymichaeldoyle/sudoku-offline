// Build App Store marketing screenshots from raw device captures.
//
// Composites each real in-app capture (assets/store/screenshots/raw/) onto a
// calm cream frame with a large caption, at the exact resolutions Apple
// requires: iPhone 6.9" (1320x2868) and iPad 13" (2064x2752). App Store Connect
// auto-scales those down for every smaller device, so these two slots cover all.
//
// Re-capture the raw sources from the simulators, then run: pnpm generate:screenshots
// Style follows docs/DESIGN_GUIDELINES.md §20.2.

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { Resvg } from "@resvg/resvg-js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const RAW = resolve(ROOT, "assets/store/screenshots/raw");
const OUT = resolve(ROOT, "assets/store/screenshots");

const BG_TOP = "#FBF9F3"; // subtle warm gradient (top → bottom)
const BG_BOTTOM = "#EFE7D6";
const INK = "#1F2937";
const SOFT = "#667085";
const ACCENT = "#DDBB72"; // gold brand accent rule under the caption
const BORDER = "#E4DCCB";
const SHADOW = "#2F3A5F"; // tinted (indigo) soft shadow under the device
const FONT = "Helvetica Neue, Helvetica, Arial, sans-serif";

// Per-device canvas (the required App Store size), the raw capture size, and the
// caption/device frame geometry.
const DEVICES = {
  iphone: {
    canvas: { w: 1320, h: 2868 },
    src: { w: 1206, h: 2622 },
    caption: { size: 96, top: 215 },
    subtitle: { size: 46, gap: 78 },
    device: { width: 1000, top: 470, radius: 64 },
  },
  ipad: {
    canvas: { w: 2064, h: 2752 },
    src: { w: 2064, h: 2752 },
    caption: { size: 116, top: 250 },
    subtitle: { size: 56, gap: 92 },
    device: { width: 1560, top: 560, radius: 40 },
  },
};

// Each shot reuses the same raw filename across both devices (raw/<device>-<name>.png).
const SHOTS = [
  { name: "1-home", caption: "Calm, classic Sudoku", subtitle: "Works offline — no Wi-Fi needed" },
  {
    name: "2-game",
    caption: "No ads while you play",
    subtitle: "Stay focused from start to finish",
  },
  { name: "3-stats", caption: "Build a daily streak", subtitle: "Track your times and progress" },
  { name: "4-dark", caption: "Easy on the eyes", subtitle: "A calm dark mode for night sessions" },
];

function escapeXml(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function buildSvg(device, shot, dataUri) {
  const d = DEVICES[device];
  const { w, h } = d.canvas;
  const cx = w / 2;

  const dw = d.device.width;
  const dh = Math.round(dw * (d.src.h / d.src.w));
  const dx = Math.round((w - dw) / 2);
  const dy = d.device.top;
  const r = d.device.radius;

  const caption = `<text x="${cx}" y="${d.caption.top}" font-family="${FONT}" font-size="${d.caption.size}" font-weight="700" fill="${INK}" text-anchor="middle">${escapeXml(shot.caption)}</text>`;
  const subtitle = shot.subtitle
    ? `<text x="${cx}" y="${d.caption.top + d.subtitle.gap}" font-family="${FONT}" font-size="${d.subtitle.size}" font-weight="500" fill="${SOFT}" text-anchor="middle">${escapeXml(shot.subtitle)}</text>`
    : "";
  // Short gold rule under the caption block — a small calm brand accent.
  const accentY = d.caption.top + d.subtitle.gap + Math.round(d.subtitle.size * 0.9);
  const accentW = Math.round(w * 0.07);
  const accent = `<rect x="${cx - accentW / 2}" y="${accentY}" width="${accentW}" height="6" rx="3" fill="${ACCENT}"/>`;

  // Soft tinted drop shadow so the screenshot reads as a floating device card.
  const shadowDy = Math.round(dw * 0.018);
  const shadowBlur = Math.round(dw * 0.03);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="${BG_TOP}"/>
        <stop offset="100%" stop-color="${BG_BOTTOM}"/>
      </linearGradient>
      <clipPath id="r"><rect x="${dx}" y="${dy}" width="${dw}" height="${dh}" rx="${r}"/></clipPath>
      <filter id="shadow" x="-40%" y="-40%" width="180%" height="180%">
        <feDropShadow dx="0" dy="${shadowDy}" stdDeviation="${shadowBlur}" flood-color="${SHADOW}" flood-opacity="0.20"/>
      </filter>
    </defs>
    <rect width="${w}" height="${h}" fill="url(#bg)"/>
    ${caption}
    ${subtitle}
    ${accent}
    <rect x="${dx}" y="${dy}" width="${dw}" height="${dh}" rx="${r}" fill="#FFFFFF" filter="url(#shadow)"/>
    <image x="${dx}" y="${dy}" width="${dw}" height="${dh}" href="${dataUri}" clip-path="url(#r)"/>
    <rect x="${dx}" y="${dy}" width="${dw}" height="${dh}" rx="${r}" fill="none" stroke="${BORDER}" stroke-width="2"/>
  </svg>`;
}

async function main() {
  let count = 0;
  for (const device of Object.keys(DEVICES)) {
    await mkdir(resolve(OUT, device), { recursive: true });
    for (const shot of SHOTS) {
      const rawPath = resolve(RAW, `${device}-${shot.name}.png`);
      const b64 = (await readFile(rawPath)).toString("base64");
      const svg = buildSvg(device, shot, `data:image/png;base64,${b64}`);
      const png = new Resvg(svg, {
        font: { loadSystemFonts: true },
        fitTo: { mode: "width", value: DEVICES[device].canvas.w },
      })
        .render()
        .asPng();
      const outPath = resolve(OUT, device, `${shot.name}.png`);
      await writeFile(outPath, png);
      console.log(
        `${outPath.replace(`${ROOT}/`, "")}  (${DEVICES[device].canvas.w}x${DEVICES[device].canvas.h})`,
      );
      count++;
    }
  }
  console.log(`Done -> ${count} screenshots in assets/store/screenshots/{iphone,ipad}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
