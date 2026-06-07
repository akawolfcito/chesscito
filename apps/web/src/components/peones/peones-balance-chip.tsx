"use client";

/**
 * PeonesBalanceChip — Sprint 3 commit G of Training Economy Alpha
 * 2026-06-07. Minimal HUD chip rendering the connected wallet's
 * Peones balance. NO spend, NO top-up, NO pack-purchase. Read-only
 * surface backed by `usePeonesBalance`.
 *
 * Visibility:
 *  - guest    : returns null. Guests do NOT see a balance, NOT even
 *               a placeholder. Per Wolfcito directive 2026-06-07.
 *  - loading  : shows the chip with "…" so the layout reserves the
 *               width and doesn't pop in/out on first paint.
 *  - success  : shows "{balance} Peones".
 *  - error    : shows "Peones --" as a non-aggressive fallback.
 *               NEVER an error banner or modal — the chip is
 *               supposed to be unobtrusive.
 *
 * Visual family: reuses the canonical `candy-tray-pill hub-hud-pill`
 * chip class shared by the trophies chip and the connect chip in
 * `hub-scaffold.tsx`. The CandyIcon "star" matches the Peones =
 * Estrellas thesis from the engagement direction doc.
 */

import { useEffect, useRef } from "react";

import { CandyIcon } from "@/components/redesign/candy-icon";

import {
  emitPeonesBalanceViewed,
  type PeonesBalanceViewSurface,
} from "@/lib/peones/telemetry";
import { usePeonesBalance } from "@/lib/peones/use-peones-balance";

type Props = {
  /** Sprint 3 commit G mounts the chip only on `/hub`; the prop keeps
   *  the surface label out of the chip so a future cluster can mount
   *  it on `/exercises`, `/coach`, or `/arena` without code surgery. */
  surface?: PeonesBalanceViewSurface;
};

export function PeonesBalanceChip({ surface = "hub" }: Props = {}) {
  const { state } = usePeonesBalance();
  /** Sprint 3 commit H — last balance we emitted `peones_balance_viewed`
   *  for. Re-renders with the same number do not re-emit; a real
   *  balance change does. Cleared implicitly when the component
   *  unmounts. */
  const lastEmittedBalanceRef = useRef<number | null>(null);

  useEffect(() => {
    if (state.kind !== "success") return;
    if (lastEmittedBalanceRef.current === state.balance) return;
    lastEmittedBalanceRef.current = state.balance;
    emitPeonesBalanceViewed({
      balance: state.balance,
      dailyEarnedCapped: state.dailyEarnedCapped,
      dailyCap: state.dailyCap,
      surface,
    });
  }, [state, surface]);

  if (state.kind === "guest") return null;

  const label =
    state.kind === "success"
      ? `${state.balance} Peones`
      : state.kind === "loading"
        ? "Peones …"
        : "Peones --";

  const ariaLabel =
    state.kind === "success"
      ? `Peones balance: ${state.balance}`
      : "Peones balance";

  return (
    <div
      className="candy-tray-pill hub-hud-pill"
      role="status"
      aria-live="polite"
      aria-label={ariaLabel}
      data-testid="peones-balance-chip"
      data-state={state.kind}
    >
      <CandyIcon
        name="star"
        className="candy-tray-pill-icon candy-tray-pill-icon--floating"
      />
      <span className="tabular-nums">{label}</span>
    </div>
  );
}
