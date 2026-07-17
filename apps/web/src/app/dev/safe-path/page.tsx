"use client";

/**
 * /dev/safe-path — DEV-ONLY probe for the Safe Path mechanic.
 *
 * Renders the REAL <SafePathBoard> against the REAL catalog levels, like the
 * queens and tour probes: what the probe photographs must not be able to drift
 * from what ships.
 *
 * This probe carries more weight than its siblings. The watched squares are
 * invisible in the game BY DESIGN (plan D2) — deducing them from the enemy
 * pieces is the skill — so the founder cannot author a level by looking at it in
 * the app. `Zones` turns the map on (D3): same data the game already computes,
 * different viewer. It is the authoring surface for this game.
 *
 * `onBandChange` is deliberately left unwired: the board then renders its own
 * local band, so the mechanic is legible standalone.
 */

import { notFound } from "next/navigation";
import { isDevSurfaceEnabled } from "@/lib/dev/dev-surface";
import { useState } from "react";
import { NextIntlClientProvider } from "next-intl";
import { SafePathBoard } from "@/components/exercises/safe-path-board";
import { SAFE_PATH } from "@/lib/game/exercises";
import { labyrinthStars } from "@/lib/game/exercises";
import messages from "@/lib/content/messages/en";

export const dynamic = "force-dynamic";

export default function SafePathPage() {
  if (!isDevSurfaceEnabled()) notFound();
  return (
    <NextIntlClientProvider locale="en" messages={messages}>
      <SafePathProbe />
    </NextIntlClientProvider>
  );
}

function SafePathProbe() {
  const levels = SAFE_PATH.king;
  const [index, setIndex] = useState(0);
  const [resetKey, setResetKey] = useState(0);
  const [result, setResult] = useState<{ moves: number; optimal: number } | null>(null);
  const [caught, setCaught] = useState<string | null>(null);
  /** OFF by default, on purpose: the probe must photograph what SHIPS, and the
   *  game never draws the watched squares — reading them is the puzzle. ON is
   *  the authoring mode (D3). */
  const [zones, setZones] = useState(false);
  const level = levels[index];

  if (!level) {
    return (
      <main className="min-h-screen bg-slate-950 p-4 text-slate-200">
        No safe-path levels in the catalog. Run `pnpm import-puzzles`.
      </main>
    );
  }

  const reset = () => {
    setResult(null);
    setCaught(null);
    setResetKey((k) => k + 1);
  };

  return (
    <main className="min-h-screen bg-slate-950 py-4">
      <div className="mx-auto flex w-full max-w-[23.5rem] flex-col gap-3 px-2">
        <div className="flex flex-wrap gap-2">
          {levels.map((l, i) => (
            <button
              key={l.id}
              type="button"
              data-testid={`sp-level-${l.id}`}
              onClick={() => {
                setIndex(i);
                reset();
              }}
              className={[
                "rounded border px-2 py-1 text-xs",
                i === index
                  ? "border-amber-300 bg-amber-200 text-slate-900"
                  : "border-slate-600 text-slate-300",
              ].join(" ")}
            >
              {/* optimalMoves is the SAFE route — lower is better here. */}
              {l.id} · {l.optimalMoves} moves
            </button>
          ))}
          <button
            type="button"
            data-testid="sp-retry"
            onClick={reset}
            className="rounded border border-slate-600 px-2 py-1 text-xs text-slate-300"
          >
            Retry
          </button>
          <button
            type="button"
            data-testid="sp-zones"
            aria-pressed={zones}
            onClick={() => setZones((z) => !z)}
            className={[
              "rounded border px-2 py-1 text-xs",
              zones
                ? "border-rose-300 bg-rose-200 text-slate-900"
                : "border-slate-600 text-slate-300",
            ].join(" ")}
          >
            {/* Authoring aid — NEVER what a player sees. */}
            Zones {zones ? "on" : "off"}
          </button>
        </div>

        <SafePathBoard
          key={level.id}
          level={level}
          resetKey={resetKey}
          showWatched={zones}
          onComplete={(moves, optimal) => setResult({ moves, optimal })}
          onCaught={(sq) => setCaught(sq)}
        />

        {caught ? (
          <div data-testid="sp-caught-note" className="rounded bg-rose-950 px-3 py-2 text-xs text-rose-200">
            Caught on {caught}. In the game this is where the TRY AGAIN overlay
            fires and a shield can be spent (stage 6) — the board just reports it.
            Hit Retry to walk again from the start.
          </div>
        ) : null}

        {result ? (
          <div data-testid="sp-result" className="rounded bg-slate-800 px-3 py-2 text-xs text-slate-200">
            {result.moves} moves · optimal {result.optimal} ·{" "}
            {labyrinthStars(result.moves, result.optimal)}★
          </div>
        ) : null}
      </div>
    </main>
  );
}
