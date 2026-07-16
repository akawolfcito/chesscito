"use client";

/**
 * /dev/queens — DEV-ONLY probe for the N-Queens mechanic.
 *
 * It renders the REAL <QueensBoard> against the REAL catalog levels, rather than
 * a self-contained spike copy of the game — same call the Knight's Tour probe
 * made, and for the same reason. The Diagonal Run probe went the copy route
 * (components/dev/diagonal-run-spike.tsx) and now carries a second
 * implementation of the same rules that nothing keeps in step: what the probe
 * photographs can drift from what ships, which is the one thing a probe exists
 * to prevent.
 *
 * The only thing standing between the real board and this route is i18n — /dev
 * sits outside [locale], so there is no provider. That is a wrapper, not a
 * reason to fork the game.
 *
 * `onBandChange` is deliberately left unwired: the board then renders its own
 * local band, so the mechanic is legible standalone.
 */

import { notFound } from "next/navigation";
import { useState } from "react";
import { NextIntlClientProvider } from "next-intl";
import { QueensBoard } from "@/components/exercises/queens-board";
import { QUEENS } from "@/lib/game/exercises";
import { tourStars, isTourPass } from "@/lib/game/tour-score";
import messages from "@/lib/content/messages/en";

export const dynamic = "force-dynamic";

export default function QueensPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <NextIntlClientProvider locale="en" messages={messages}>
      <QueensProbe />
    </NextIntlClientProvider>
  );
}

function QueensProbe() {
  const levels = QUEENS.queen;
  const [index, setIndex] = useState(0);
  const [runKey, setRunKey] = useState(0);
  const [result, setResult] = useState<{ placed: number; ceiling: number } | null>(null);
  const level = levels[index];

  if (!level) {
    return (
      <main className="min-h-screen bg-slate-950 p-4 text-slate-200">
        No queens levels in the catalog. Run `pnpm import-puzzles`.
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 py-4">
      <div className="mx-auto flex w-full max-w-[23.5rem] flex-col gap-3 px-2">
        <div className="flex flex-wrap gap-2">
          {levels.map((l, i) => (
            <button
              key={l.id}
              type="button"
              data-testid={`q-level-${l.id}`}
              onClick={() => {
                setIndex(i);
                setResult(null);
                setRunKey((k) => k + 1);
              }}
              className={[
                "rounded border px-2 py-1 text-xs",
                i === index
                  ? "border-amber-300 bg-amber-200 text-slate-900"
                  : "border-slate-600 text-slate-300",
              ].join(" ")}
            >
              {/* optimalMoves is what the PLAYER places; +1 is the ceiling. */}
              {l.id} · ×{l.optimalMoves + 1}
            </button>
          ))}
          <button
            type="button"
            data-testid="q-retry"
            onClick={() => {
              setResult(null);
              setRunKey((k) => k + 1);
            }}
            className="rounded border border-slate-600 px-2 py-1 text-xs text-slate-300"
          >
            Retry
          </button>
        </div>

        <QueensBoard
          key={`${level.id}-${runKey}`}
          level={level}
          onComplete={(placed, ceiling) => setResult({ placed, ceiling })}
        />

        {result ? (
          <div data-testid="q-result" className="rounded bg-slate-800 px-3 py-2 text-xs text-slate-200">
            placed {result.placed}/{result.ceiling} ·{" "}
            {Math.round((result.placed / result.ceiling) * 100)}% ·{" "}
            {tourStars(result.placed, result.ceiling)}★ ·{" "}
            {isTourPass(result.placed, result.ceiling) ? "PASS" : "below 80% — pass with 0★ or retry"}
          </div>
        ) : null}
      </div>
    </main>
  );
}
