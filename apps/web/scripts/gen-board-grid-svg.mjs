// Generates a Figma-ready SVG of the exercises/builder board grid.
// Geometry mirrors src/lib/game/board-geometry.ts (uniform 12.5%/cell) inside
// the hit-grid inset from globals.css `.playhub-board-hitgrid`.
// Run: node apps/web/scripts/gen-board-grid-svg.mjs
import { writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const S = 1024; // board side (source art is 1024×1024, aspect 1:1)
// inset: top right bottom left (%) — keep in sync with globals.css.
const INSET = { top: 5.25, right: 9.25, bottom: 12.75, left: 10.25 };
const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"];

const x0 = (INSET.left / 100) * S;
const y0 = (INSET.top / 100) * S;
const gridW = ((100 - INSET.left - INSET.right) / 100) * S;
const gridH = ((100 - INSET.top - INSET.bottom) / 100) * S;
const cw = gridW / 8;
const ch = gridH / 8;
const r2 = (n) => Math.round(n * 100) / 100;

const cells = [];
const labels = [];
const centers = [];
for (let rank = 7; rank >= 0; rank--) {
  for (let file = 0; file < 8; file++) {
    const row = 7 - rank; // row 0 = rank 8 (top)
    const x = x0 + file * cw;
    const y = y0 + row * ch;
    const label = `${FILES[file]}${rank + 1}`;
    const isDark = (file + rank) % 2 === 0;
    cells.push(
      `    <rect id="${label}" x="${r2(x)}" y="${r2(y)}" width="${r2(cw)}" height="${r2(ch)}" ` +
        `fill="${isDark ? "rgba(255,0,200,0.18)" : "rgba(0,220,255,0.18)"}" ` +
        `stroke="#ff2ec4" stroke-width="1"><title>${label}</title></rect>`,
    );
    labels.push(
      `    <text x="${r2(x + cw / 2)}" y="${r2(y + ch / 2)}" font-family="sans-serif" ` +
        `font-size="20" font-weight="700" fill="#ffffff" text-anchor="middle" ` +
        `dominant-baseline="central">${label}</text>`,
    );
    centers.push(
      `    <circle cx="${r2(x + cw / 2)}" cy="${r2(y + ch / 2)}" r="4" fill="#ffff00" stroke="#000000" stroke-width="1"/>`,
    );
  }
}

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}" viewBox="0 0 ${S} ${S}">
  <!-- Chesscito board grid guide — ${S}×${S}. Cells are ${r2(cw)}×${r2(ch)}px (NOT square:
       grid box is ${r2(gridW)}×${r2(gridH)} due to asymmetric inset
       top ${INSET.top}% right ${INSET.right}% bottom ${INSET.bottom}% left ${INSET.left}%). -->
  <rect x="0" y="0" width="${S}" height="${S}" fill="none" stroke="#666666" stroke-width="1"/>
  <rect x="${r2(x0)}" y="${r2(y0)}" width="${r2(gridW)}" height="${r2(gridH)}" fill="none" stroke="#ffffff" stroke-width="2"/>
  <g id="cells">
${cells.join("\n")}
  </g>
  <g id="labels">
${labels.join("\n")}
  </g>
  <g id="centers">
${centers.join("\n")}
  </g>
</svg>
`;

const __dirname = dirname(fileURLToPath(import.meta.url));
const out = resolve(__dirname, "../../../docs/design/board-grid-1024.svg");
writeFileSync(out, svg);
console.log(`wrote ${out}`);
console.log(`cell = ${r2(cw)} × ${r2(ch)} px  ·  grid = ${r2(gridW)} × ${r2(gridH)} @ (${r2(x0)}, ${r2(y0)})`);
