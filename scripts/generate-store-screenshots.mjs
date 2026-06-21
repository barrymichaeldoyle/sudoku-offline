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
const SHADOW = "#2F3A5F"; // tinted (indigo) soft shadow under the device

// Device body (drawn as a stylised metal frame around the screenshot).
const BODY_TOP = "#3B3F48"; // body gradient top (lighter, like a top edge highlight)
const BODY_BOTTOM = "#191B20"; // body gradient bottom
const RIM = "#53575F"; // thin outer edge highlight
const SCREEN_EDGE = "#000000"; // subtle dark line where the screen meets the bezel
const BUTTON = "#202329"; // side buttons

const FONT = "Helvetica Neue, Helvetica, Arial, sans-serif";

// Per-device canvas (the required App Store size), the raw capture size, and the
// caption/device frame geometry.
const DEVICES = {
  iphone: {
    canvas: { w: 1320, h: 2868 },
    src: { w: 1206, h: 2622 },
    caption: { size: 92, top: 210 },
    subtitle: { size: 46, gap: 74 },
    // screenW drives everything; the body adds `bezel` on every side.
    frame: { screenW: 968, bezel: 20, top: 500, bodyRadius: 150 },
  },
  ipad: {
    canvas: { w: 2064, h: 2752 },
    src: { w: 2064, h: 2752 },
    caption: { size: 112, top: 244 },
    subtitle: { size: 54, gap: 88 },
    frame: { screenW: 1480, bezel: 26, top: 474, bodyRadius: 80 },
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
  const fr = d.frame;

  // Screen (the screenshot) and the body that wraps it with a uniform bezel.
  const screenW = fr.screenW;
  const screenH = Math.round(screenW * (d.src.h / d.src.w));
  const bodyW = screenW + fr.bezel * 2;
  const bodyH = screenH + fr.bezel * 2;
  const bodyX = Math.round((w - bodyW) / 2);
  const bodyY = fr.top;
  const sx = bodyX + fr.bezel;
  const sy = bodyY + fr.bezel;
  const bodyR = fr.bodyRadius;
  const screenR = bodyR - fr.bezel; // concentric inner corners

  const caption = `<text x="${cx}" y="${d.caption.top}" font-family="${FONT}" font-size="${d.caption.size}" font-weight="700" fill="${INK}" text-anchor="middle">${escapeXml(shot.caption)}</text>`;
  const subtitle = shot.subtitle
    ? `<text x="${cx}" y="${d.caption.top + d.subtitle.gap}" font-family="${FONT}" font-size="${d.subtitle.size}" font-weight="500" fill="${SOFT}" text-anchor="middle">${escapeXml(shot.subtitle)}</text>`
    : "";
  // Short gold rule under the caption block — a small calm brand accent.
  const accentY = d.caption.top + d.subtitle.gap + Math.round(d.subtitle.size * 0.9);
  const accentW = Math.round(w * 0.07);
  const accent = `<rect x="${cx - accentW / 2}" y="${accentY}" width="${accentW}" height="6" rx="3" fill="${ACCENT}"/>`;

  // Side buttons — drawn before the body so the body overlaps their inner edge
  // and they read as protruding from under it.
  const btn = (x, y, bw, bh) =>
    `<rect x="${x}" y="${y}" width="${bw}" height="${bh}" rx="${Math.min(bw, bh) / 2}" fill="${BUTTON}"/>`;
  let buttons = "";
  if (device === "iphone") {
    const t = 9; // protrusion thickness
    const tuck = 4; // how far it tucks under the body
    // Left: mute switch + two volume buttons.
    buttons += btn(
      bodyX - t + tuck,
      bodyY + Math.round(bodyH * 0.17),
      t,
      Math.round(bodyH * 0.035),
    );
    buttons += btn(bodyX - t + tuck, bodyY + Math.round(bodyH * 0.25), t, Math.round(bodyH * 0.07));
    buttons += btn(bodyX - t + tuck, bodyY + Math.round(bodyH * 0.34), t, Math.round(bodyH * 0.07));
    // Right: power button.
    buttons += btn(
      bodyX + bodyW - tuck,
      bodyY + Math.round(bodyH * 0.27),
      t,
      Math.round(bodyH * 0.11),
    );
  } else {
    const t = 8;
    const tuck = 3;
    // Top edge: power + volume (iPad Pro/Air placement).
    buttons += btn(bodyX + Math.round(bodyW * 0.72), bodyY - t + tuck, Math.round(bodyW * 0.09), t);
    buttons += btn(bodyX + Math.round(bodyW * 0.83), bodyY - t + tuck, Math.round(bodyW * 0.06), t);
  }

  const shadowDy = Math.round(bodyW * 0.02);
  const shadowBlur = Math.round(bodyW * 0.035);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="${BG_TOP}"/>
        <stop offset="100%" stop-color="${BG_BOTTOM}"/>
      </linearGradient>
      <linearGradient id="body" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="${BODY_TOP}"/>
        <stop offset="100%" stop-color="${BODY_BOTTOM}"/>
      </linearGradient>
      <clipPath id="screen"><rect x="${sx}" y="${sy}" width="${screenW}" height="${screenH}" rx="${screenR}"/></clipPath>
      <filter id="shadow" x="-40%" y="-40%" width="180%" height="180%">
        <feDropShadow dx="0" dy="${shadowDy}" stdDeviation="${shadowBlur}" flood-color="${SHADOW}" flood-opacity="0.22"/>
      </filter>
    </defs>
    <rect width="${w}" height="${h}" fill="url(#bg)"/>
    ${caption}
    ${subtitle}
    ${accent}
    <g filter="url(#shadow)">
      ${buttons}
      <rect x="${bodyX}" y="${bodyY}" width="${bodyW}" height="${bodyH}" rx="${bodyR}" fill="url(#body)" stroke="${RIM}" stroke-width="2"/>
    </g>
    <image x="${sx}" y="${sy}" width="${screenW}" height="${screenH}" href="${dataUri}" clip-path="url(#screen)"/>
    <rect x="${sx}" y="${sy}" width="${screenW}" height="${screenH}" rx="${screenR}" fill="none" stroke="${SCREEN_EDGE}" stroke-opacity="0.35" stroke-width="2"/>
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
