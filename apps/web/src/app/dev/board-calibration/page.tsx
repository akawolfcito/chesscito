"use client";

/**
 * /dev/board-calibration — dev-only board grid calibration overlay.
 *
 * Paints all 64 hit-grid cells in strong colors over the real board image so
 * the misalignment between the engine's uniform 8x8 grid and the bg art's
 * painted squares is visible at a glance. Two uses:
 *   1) Guide for REDRAWING the bg so its squares match the engine grid.
 *   2) Live-tune the hit-grid inset (top/right/bottom/left) to fit the CURRENT
 *      bg, then copy the values into globals.css `.playhub-board-hitgrid`.
 *
 * Reuses the canonical geometry (`cellGeometry`/`cellCenter`) and the board
 * sprite so what you see matches what /exercises renders.
 */
import { useState } from "react";
import { notFound } from "next/navigation";
import { cellGeometry, cellCenter } from "@/lib/game/board-geometry";

export const dynamic = "force-dynamic";

const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"];
// Current production inset (globals.css .playhub-board-hitgrid): top right bottom left.
const DEFAULT_INSET = { top: 5.25, right: 9.25, bottom: 12.75, left: 10.25 };

type Inset = typeof DEFAULT_INSET;

// 64 squares as (file, rank), rank 0 = row 1 (bottom).
const SQUARES = Array.from({ length: 64 }, (_, i) => {
  const file = i % 8;
  const rank = 7 - Math.floor(i / 8);
  return { file, rank, label: `${FILES[file]}${rank + 1}` };
});

export default function BoardCalibrationPage() {
  if (process.env.NODE_ENV === "production") notFound();

  const [inset, setInset] = useState<Inset>(DEFAULT_INSET);
  const [fill, setFill] = useState(0.45);
  const [showLabels, setShowLabels] = useState(true);
  const [showCenters, setShowCenters] = useState(true);
  const [showBoard, setShowBoard] = useState(true);

  const insetCss = `${inset.top}% ${inset.right}% ${inset.bottom}% ${inset.left}%`;

  function setSide(side: keyof Inset, value: number) {
    setInset((prev) => ({ ...prev, [side]: value }));
  }

  // Build a Figma-ready SVG (1024×1024) from the CURRENT inset, so a tuned grid
  // exports exactly as previewed. Mirrors scripts/gen-board-grid-svg.mjs.
  function exportSvg() {
    const S = 1024;
    const x0 = (inset.left / 100) * S;
    const y0 = (inset.top / 100) * S;
    const gridW = ((100 - inset.left - inset.right) / 100) * S;
    const gridH = ((100 - inset.top - inset.bottom) / 100) * S;
    const cw = gridW / 8;
    const ch = gridH / 8;
    const r2 = (n: number) => Math.round(n * 100) / 100;
    const cells: string[] = [];
    const labels: string[] = [];
    const centers: string[] = [];
    for (const sq of SQUARES) {
      const row = 7 - sq.rank;
      const x = x0 + sq.file * cw;
      const y = y0 + row * ch;
      const isDark = (sq.file + sq.rank) % 2 === 0;
      cells.push(
        `<rect id="${sq.label}" x="${r2(x)}" y="${r2(y)}" width="${r2(cw)}" height="${r2(ch)}" fill="${isDark ? "rgba(255,0,200,0.18)" : "rgba(0,220,255,0.18)"}" stroke="#ff2ec4" stroke-width="1"><title>${sq.label}</title></rect>`,
      );
      labels.push(
        `<text x="${r2(x + cw / 2)}" y="${r2(y + ch / 2)}" font-family="sans-serif" font-size="20" font-weight="700" fill="#fff" text-anchor="middle" dominant-baseline="central">${sq.label}</text>`,
      );
      centers.push(
        `<circle cx="${r2(x + cw / 2)}" cy="${r2(y + ch / 2)}" r="4" fill="#ff0" stroke="#000" stroke-width="1"/>`,
      );
    }
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}" viewBox="0 0 ${S} ${S}"><rect x="0" y="0" width="${S}" height="${S}" fill="none" stroke="#666" stroke-width="1"/><rect x="${r2(x0)}" y="${r2(y0)}" width="${r2(gridW)}" height="${r2(gridH)}" fill="none" stroke="#fff" stroke-width="2"/><g id="cells">${cells.join("")}</g><g id="labels">${labels.join("")}</g><g id="centers">${centers.join("")}</g></svg>`;
    const blob = new Blob([svg], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `board-grid-${inset.top}-${inset.right}-${inset.bottom}-${inset.left}.svg`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="min-h-screen bg-slate-950 p-4 text-slate-100">
      <div className="mx-auto flex max-w-4xl flex-col gap-4 lg:flex-row">
        {/* ── Board column ── */}
        <section className="flex flex-col gap-2">
          <h1 className="text-lg font-bold">Board Grid Calibration (dev)</h1>
          <p className="max-w-[23.5rem] text-xs text-slate-400">
            Strong-colored cells show where the engine places each square. Tune
            the inset until they sit on the bg squares, or redraw the bg to match.
          </p>

          <div className="playhub-board-canvas">
            {showBoard && (
              <picture className="playhub-board-img">
                <source srcSet="/art/redesign/board/board-ch.avif" type="image/avif" />
                <source srcSet="/art/redesign/board/board-ch.webp" type="image/webp" />
                <img src="/art/redesign/board/board-ch.png" alt="" />
              </picture>
            )}

            {/* Calibration overlay box — same role as .playhub-board-hitgrid but
                with a live-tunable inset. */}
            <div
              style={{
                position: "absolute",
                top: `${inset.top}%`,
                right: `${inset.right}%`,
                bottom: `${inset.bottom}%`,
                left: `${inset.left}%`,
              }}
            >
              {SQUARES.map((sq) => {
                const geo = cellGeometry(sq.file, sq.rank);
                const isDark = (sq.file + sq.rank) % 2 === 0;
                // Two strong colors in a checker so adjacent cells are distinct.
                const color = isDark
                  ? `rgba(255, 0, 200, ${fill})`
                  : `rgba(0, 220, 255, ${fill})`;
                return (
                  <div
                    key={sq.label}
                    style={{
                      position: "absolute",
                      left: `${geo.left}%`,
                      top: `${geo.top}%`,
                      width: `${geo.width}%`,
                      height: `${geo.height}%`,
                      background: color,
                      outline: "1px solid rgba(255,255,255,0.85)",
                      outlineOffset: "-1px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "0.6rem",
                      fontWeight: 700,
                      color: "rgba(255,255,255,0.95)",
                      textShadow: "0 1px 2px rgba(0,0,0,0.9)",
                    }}
                  >
                    {showLabels && sq.label}
                  </div>
                );
              })}

              {/* Center dots — where piece/star sprites anchor (cellCenter). */}
              {showCenters &&
                SQUARES.map((sq) => {
                  const c = cellCenter(sq.file, sq.rank);
                  return (
                    <div
                      key={`c-${sq.label}`}
                      style={{
                        position: "absolute",
                        left: `${c.x}%`,
                        top: `${c.y}%`,
                        width: 6,
                        height: 6,
                        marginLeft: -3,
                        marginTop: -3,
                        borderRadius: "50%",
                        background: "rgba(255,255,0,0.95)",
                        boxShadow: "0 0 0 1px rgba(0,0,0,0.8)",
                      }}
                    />
                  );
                })}
            </div>
          </div>
        </section>

        {/* ── Controls column ── */}
        <section className="flex flex-1 flex-col gap-4">
          <div className="rounded border border-slate-800 bg-slate-900 p-3">
            <p className="mb-2 font-semibold text-slate-300">Hit-grid inset (%)</p>
            {(["top", "right", "bottom", "left"] as (keyof Inset)[]).map((side) => (
              <label key={side} className="mb-2 flex items-center gap-2 text-sm">
                <span className="w-16 capitalize text-slate-400">{side}</span>
                <input
                  type="range"
                  min={0}
                  max={20}
                  step={0.05}
                  value={inset[side]}
                  onChange={(e) => setSide(side, Number(e.target.value))}
                  className="flex-1"
                />
                <input
                  type="number"
                  min={0}
                  max={20}
                  step={0.05}
                  value={inset[side]}
                  onChange={(e) => setSide(side, Number(e.target.value))}
                  className="w-20 rounded bg-slate-800 px-2 py-1 text-right font-mono text-xs"
                />
              </label>
            ))}
            <div className="mt-1 flex gap-2">
              <button
                type="button"
                onClick={() => setInset(DEFAULT_INSET)}
                className="rounded bg-slate-700 px-3 py-1 text-xs hover:bg-slate-600"
              >
                Reset to current globals.css
              </button>
              <button
                type="button"
                onClick={exportSvg}
                className="rounded bg-emerald-600 px-3 py-1 text-xs font-semibold text-white hover:bg-emerald-500"
              >
                Export SVG (Figma)
              </button>
            </div>
          </div>

          <div className="rounded border border-slate-800 bg-slate-900 p-3 text-sm">
            <p className="mb-1 font-semibold text-slate-300">Copy into globals.css</p>
            <pre
              className="overflow-x-auto whitespace-pre-wrap break-all font-mono text-xs text-emerald-300"
              data-allow-select="true"
            >{`.playhub-board-hitgrid {\n  inset: ${insetCss};\n}`}</pre>
          </div>

          <div className="flex flex-col gap-2 rounded border border-slate-800 bg-slate-900 p-3 text-sm">
            <label className="flex items-center gap-2">
              <span className="w-24 text-slate-400">Cell opacity</span>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={fill}
                onChange={(e) => setFill(Number(e.target.value))}
                className="flex-1"
              />
              <span className="w-10 text-right font-mono text-xs">{fill.toFixed(2)}</span>
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={showLabels} onChange={(e) => setShowLabels(e.target.checked)} />
              <span className="text-slate-300">Show coordinate labels</span>
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={showCenters} onChange={(e) => setShowCenters(e.target.checked)} />
              <span className="text-slate-300">Show piece-anchor centers (yellow dots)</span>
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={showBoard} onChange={(e) => setShowBoard(e.target.checked)} />
              <span className="text-slate-300">Show board image</span>
            </label>
          </div>
        </section>
      </div>
    </main>
  );
}
