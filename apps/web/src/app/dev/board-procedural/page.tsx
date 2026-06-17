'use client'

/**
 * /dev/board-procedural — dev-only proof-of-concept of a fully programmatic
 * board. Renders the shared <ProceduralBoard> (textured tiles + supplied frame
 * PNG, grid inset to the frame's measured opening) plus palette controls and a
 * Figma SVG export of the grid geometry.
 */
import { useState } from 'react'
import { notFound } from 'next/navigation'
import {
  ProceduralBoard,
  FILES,
  RANKS,
  BOARD_INSET,
  BOARD_INNER_W,
  BOARD_INNER_H,
  isDarkSquare,
} from '../_components/procedural-board'

export const dynamic = 'force-dynamic'

export default function BoardProceduralPage() {
  if (process.env.NODE_ENV === 'production') notFound()

  const [darkColor, setDarkColor] = useState('#7fb24a')
  const [lightColor, setLightColor] = useState('#efe6c4')
  const [showLabels, setShowLabels] = useState(true)

  function exportSvg() {
    const S = 1000
    const x0 = (BOARD_INSET.left / 100) * S
    const y0 = (BOARD_INSET.top / 100) * S
    const cw = ((BOARD_INNER_W / 100) * S) / 8
    const ch = ((BOARD_INNER_H / 100) * S) / 8
    const r2 = (n: number) => Math.round(n * 100) / 100
    const cells: string[] = []
    RANKS.forEach((rank, row) =>
      FILES.forEach((file, col) => {
        const dark = isDarkSquare(col, rank)
        cells.push(
          `<rect id="${file}${rank}" x="${r2(x0 + col * cw)}" y="${r2(
            y0 + row * ch,
          )}" width="${r2(cw)}" height="${r2(ch)}" fill="${
            dark ? darkColor : lightColor
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
          <ProceduralBoard
            showCoordinates={showLabels}
            darkColor={darkColor}
            lightColor={lightColor}
          />
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
              Frame opening inset — top {BOARD_INSET.top}% · right{' '}
              {BOARD_INSET.right}% · bottom {BOARD_INSET.bottom}% · left{' '}
              {BOARD_INSET.left}% · inner {BOARD_INNER_W.toFixed(2)}% ×{' '}
              {BOARD_INNER_H.toFixed(2)}%
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
