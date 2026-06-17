'use client'

/**
 * /dev/board-procedural — dev-only proof-of-concept of a fully programmatic
 * board. The 8×8 squares ARE the board (textured tiles drawn by code), so cell
 * alignment is guaranteed by construction. The candy frame is the supplied
 * border PNG (transparent center) overlaid on top; the grid is inset to the
 * frame's measured inner opening so the squares sit exactly inside the tube.
 *
 * Assets (dev): casilla-clara/oscura tiles + borde-tablero-chesscito frame.
 */
import { useState, type CSSProperties } from 'react'
import { notFound } from 'next/navigation'

export const dynamic = 'force-dynamic'

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']
const RANKS = [8, 7, 6, 5, 4, 3, 2, 1] // top → bottom

// Measured inner opening of borde-tablero-chesscito1.png (1040×1028): the green
// tube's transparent center. Insets are % of the board square.
const INSET = { top: 3.4, right: 3.56, bottom: 3.99, left: 3.65 }
const INNER_W = 100 - INSET.left - INSET.right // 92.79
const INNER_H = 100 - INSET.top - INSET.bottom // 92.61

const TILE_LIGHT = '/dev/tablero/casilla-clara.png'
const TILE_DARK = '/dev/tablero/casilla-oscura.png'
const BORDER = '/dev/tablero/borde-tablero-chesscito1.png'

// Corner coordinate label: cream fill + black stroke so it reads on BOTH the
// cream and green tiles (paintOrder keeps the stroke behind the glyph so thin
// text stays legible). Sally's recipe — one consistent in-cell system.
const LABEL_STYLE: CSSProperties = {
  position: 'absolute',
  fontSize: '1rem',
  fontWeight: 900,
  lineHeight: 1,
  color: '#d9f17e',
  WebkitTextStrokeWidth: '2px',
  WebkitTextStrokeColor: '#1c300a',
  paintOrder: 'stroke',
  pointerEvents: 'none',
  userSelect: 'none',
}

export default function BoardProceduralPage() {
  if (process.env.NODE_ENV === 'production') notFound()

  const [darkColor, setDarkColor] = useState('#7fb24a')
  const [lightColor, setLightColor] = useState('#efe6c4')
  const [showLabels, setShowLabels] = useState(true)

  function exportSvg() {
    const S = 1000
    const x0 = (INSET.left / 100) * S
    const y0 = (INSET.top / 100) * S
    const cw = ((INNER_W / 100) * S) / 8
    const ch = ((INNER_H / 100) * S) / 8
    const r2 = (n: number) => Math.round(n * 100) / 100
    const cells: string[] = []
    RANKS.forEach((rank, row) =>
      FILES.forEach((file, col) => {
        const isDark = (col + (8 - rank)) % 2 === 0
        cells.push(
          `<rect id="${file}${rank}" x="${r2(x0 + col * cw)}" y="${r2(
            y0 + row * ch,
          )}" width="${r2(cw)}" height="${r2(ch)}" fill="${
            isDark ? darkColor : lightColor
          }"/>`,
        )
      }),
    )
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}" viewBox="0 0 ${S} ${S}"><g id="cells">${cells.join(
      '',
    )}</g></svg>`
    const blob = new Blob([svg], { type: 'image/svg+xml' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'board-grid-procedural.svg'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <main className="min-h-screen bg-slate-950 p-4 text-slate-100">
      <div className="mx-auto flex max-w-4xl flex-col gap-4 lg:flex-row">
        <section className="flex flex-col gap-2">
          <h1 className="text-lg font-bold">Procedural Board (dev)</h1>
          <p className="max-w-[23.5rem] text-xs text-slate-400">
            Textured tiles + supplied frame PNG. Grid inset to the frame&apos;s
            measured opening — cells sit exactly inside the tube.
          </p>

          <div
            style={{
              width: 'min(100%, 23.5rem)',
              aspectRatio: '1 / 1',
              position: 'relative',
            }}
          >
            {/* 8×8 textured grid, inset to the frame opening (below the border) */}
            <div
              style={{
                position: 'absolute',
                top: `${INSET.top}%`,
                right: `${INSET.right}%`,
                bottom: `${INSET.bottom}%`,
                left: `${INSET.left}%`,
                display: 'grid',
                gridTemplateColumns: 'repeat(8, 1fr)',
                gridTemplateRows: 'repeat(8, 1fr)',
                zIndex: 1,
              }}
            >
              {RANKS.map((rank) =>
                FILES.map((file, col) => {
                  const isDark = (col + (8 - rank)) % 2 === 0
                  return (
                    <div
                      key={`${file}${rank}`}
                      style={{
                        backgroundColor: isDark ? darkColor : lightColor,
                        backgroundImage: `url(${
                          isDark ? TILE_DARK : TILE_LIGHT
                        })`,
                        backgroundSize: '100% 100%',
                      }}
                      title={`${file}${rank}`}
                    />
                  )
                }),
              )}
            </div>

            {/* Candy frame — supplied PNG, transparent center, on top */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={BORDER}
              alt=""
              style={{
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                zIndex: 2,
                pointerEvents: 'none',
              }}
            />

            {/* Coordinate labels ON the frame band (over the green tube), cream
                fill + black stroke so they read on the green. */}
            {showLabels &&
              RANKS.map((rank, row) => (
                <span
                  key={`rank-${rank}`}
                  style={{
                    ...LABEL_STYLE,
                    left: `${INSET.left / 2}%`,
                    top: `${INSET.top + (INNER_H * (row + 0.5)) / 8}%`,
                    transform: 'translate(-50%, -50%)',
                    zIndex: 3,
                  }}
                >
                  {rank}
                </span>
              ))}
            {showLabels &&
              FILES.map((file, col) => (
                <span
                  key={`file-${file}`}
                  style={{
                    ...LABEL_STYLE,
                    left: `${INSET.left + (INNER_W * (col + 0.5)) / 8}%`,
                    top: `${100 - INSET.bottom / 2}%`,
                    transform: 'translate(-50%, -50%)',
                    zIndex: 3,
                  }}
                >
                  {file}
                </span>
              ))}
          </div>
        </section>

        <section className="flex flex-1 flex-col gap-4">
          <div className="flex flex-col gap-3 rounded border border-slate-800 bg-slate-900 p-3 text-sm">
            <p className="font-semibold text-slate-300">Tile fallback colors</p>
            {[
              ['Dark square', darkColor, setDarkColor],
              ['Light square', lightColor, setLightColor],
            ].map(([label, value, set]) => (
              <label key={label as string} className="flex items-center gap-3">
                <input
                  type="color"
                  value={value as string}
                  onChange={(e) => (set as (v: string) => void)(e.target.value)}
                  className="h-8 w-12 rounded bg-transparent"
                />
                <span className="w-28 text-slate-400">{label as string}</span>
                <span className="font-mono text-xs">{value as string}</span>
              </label>
            ))}
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={showLabels}
                onChange={(e) => setShowLabels(e.target.checked)}
              />
              <span className="text-slate-300">Show coordinate labels</span>
            </label>
          </div>

          <div className="rounded border border-slate-800 bg-slate-900 p-3 text-sm">
            <p className="mb-1 font-semibold text-slate-300">Geometry</p>
            <p className="text-slate-400">
              Frame opening inset — top {INSET.top}% · right {INSET.right}% ·
              bottom {INSET.bottom}% · left {INSET.left}% · inner{' '}
              {INNER_W.toFixed(2)}% × {INNER_H.toFixed(2)}% (square)
            </p>
          </div>

          <button
            type="button"
            onClick={exportSvg}
            className="self-start rounded bg-emerald-600 px-3 py-1 text-xs font-semibold text-white hover:bg-emerald-500"
          >
            Export grid SVG (Figma)
          </button>
        </section>
      </div>
    </main>
  )
}
