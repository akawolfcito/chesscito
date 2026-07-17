"use client";

/**
 * /dev/promotion-run — DEV-ONLY probe for the Promotion Run mechanic.
 *
 * Renders the REAL <PromotionRunBoard> against the REAL catalog levels, like
 * the safe-path, queens and tour probes: what the probe photographs must not be
 * able to drift from what ships. (The Diagonal Run spike forked the board into
 * a copy and left two implementations with nothing keeping them in sync — not
 * repeating that.)
 *
 * Like /dev/safe-path, this probe is the AUTHORING surface, not just a demo:
 * the watched squares are invisible in the game by design (D2), so the founder
 * cannot design a level by looking at it in the app. `Zones` turns the map on
 * (D3).
 *
 * ⚠️ And here Zones shows something /dev/safe-path cannot: the map is LIVE.
 * Capture a piece and its zone disappears as you watch. That is the whole
 * subject of these levels — `pawn-promotion-*` promote on squares that stay
 * fatal until the piece watching them is taken — so a map frozen at the start
 * would be an authoring tool that lies at exactly the moment it matters.
 *
 * `onBandChange` is deliberately left unwired: the board then renders its own
 * local band, so the mechanic is legible standalone.
 */

import { notFound } from "next/navigation";
import { useState } from "react";
import { NextIntlClientProvider } from "next-intl";
import { PromotionRunBoard } from "@/components/exercises/promotion-run-board";
import { PROMOTION_RUN } from "@/lib/game/exercises";
import messages from "@/lib/content/messages/en";

export const dynamic = "force-dynamic";

export default function PromotionRunPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <NextIntlClientProvider locale="en" messages={messages}>
      <PromotionRunProbe />
    </NextIntlClientProvider>
  );
}

function PromotionRunProbe() {
  const levels = PROMOTION_RUN.pawn;
  const [index, setIndex] = useState(0);
  const [resetKey, setResetKey] = useState(0);
  const [result, setResult] = useState<{ moves: number; optimal: number } | null>(
    null,
  );
  const [caught, setCaught] = useState<string | null>(null);
  /** OFF by default, on purpose: the probe must photograph what SHIPS, and the
   *  game never draws the watched squares — reading them is the puzzle. ON is
   *  the authoring mode (D3). */
  const [zones, setZones] = useState(false);
  const level = levels[index];

  if (!level) {
    return (
      <main className="min-h-screen bg-slate-950 p-4 text-slate-200">
        No promotion-run levels in the catalog. Run `pnpm import-puzzles`.
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
              data-testid={`pr-level-${l.id}`}
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
              {/* The mission names the piece to crown — choosing IS the mechanic
                  (P3), so it belongs on the label, not in a footnote. */}
              {l.id} · {l.mission?.promoteTo ?? "—"}
            </button>
          ))}
          <button
            type="button"
            data-testid="pr-retry"
            onClick={reset}
            className="rounded border border-slate-600 px-2 py-1 text-xs text-slate-300"
          >
            Retry
          </button>
          <button
            type="button"
            data-testid="pr-zones"
            aria-pressed={zones}
            onClick={() => setZones((z) => !z)}
            className={[
              "rounded border px-2 py-1 text-xs",
              zones
                ? "border-rose-300 bg-rose-200 text-slate-900"
                : "border-slate-600 text-slate-300",
            ].join(" ")}
          >
            {/* Authoring aid — NEVER what a player sees. Live: it redraws as
                the pawn eats. */}
            Zones {zones ? "on" : "off"}
          </button>
        </div>

        <PromotionRunBoard
          key={level.id}
          level={level}
          resetKey={resetKey}
          showWatched={zones}
          onComplete={(moves, optimal) => setResult({ moves, optimal })}
          onCaught={(sq) => setCaught(sq)}
        />

        {caught ? (
          <div
            data-testid="pr-caught-note"
            className="rounded bg-rose-950 px-3 py-2 text-xs text-rose-200"
          >
            Caught on {caught}. In the game this is where the TRY AGAIN overlay
            fires and a shield can be spent — it reuses the king&apos;s failure
            path verbatim (stage 10). Hit Retry to run again from the start.
          </div>
        ) : null}

        {result ? (
          <div
            data-testid="pr-result"
            className="rounded bg-slate-800 px-3 py-2 text-xs text-slate-200"
          >
            Promoted in {result.moves} moves · optimal {result.optimal}
            {/* ⚠️ No star count, on purpose. Every winning run measures
                `7 - startRank`, so a move-count grade is 3★ for everyone who
                wins. Deciding what a star measures here is stage 10. */}
            <div className="mt-1 text-slate-400">
              No grade shown: every winning run is the same length, so moves
              cannot separate them. Open decision.
            </div>
          </div>
        ) : null}
      </div>
    </main>
  );
}
