"use client";

/**
 * Photographable probe for the Peones balance chip and its transaction
 * feedback (Peones V1 UX, 2026-07-21).
 *
 * Renders `PeonesBalanceChipView` — the prop-fed half of the chip —
 * exactly as `/exercises` mounts it. The connected `PeonesBalanceChip`
 * reads wagmi's `useAccount`, which THROWS with no WagmiProvider above
 * it, and the /dev layout deliberately mounts none; a probe that used it
 * would photograph Next's error overlay and pass. Same convention as
 * `HubProBadge`, `ArenaPlayerRail`, and the hub scaffolds.
 *
 * The delta variants drive the REAL code path: they dispatch on the
 * balance-change bus and then hand the chip a moved balance, which is
 * precisely what a confirmed earn or spend does in production. Nothing
 * about the badge is faked for the camera.
 */

import { useEffect, useState } from "react";

import { PeonesBalanceChipView } from "@/components/peones/peones-balance-chip";
import { dispatchPeonesChange, type PeonesChangeReason } from "@/lib/peones/peones-events";

export type PeonesChipVariant = "balance" | "earn" | "spend";

const START_BALANCE = 12;

/** Delay before the balance moves. Gives the capture script a stable
 *  window: the badge lives 1800ms, so a screenshot at ~500ms lands well
 *  inside it. */
const MOVE_AFTER_MS = 200;

const MOVES: Record<
  Exclude<PeonesChipVariant, "balance">,
  { to: number; reason: PeonesChangeReason }
> = {
  // Daily Tactic credits one Peon.
  earn: { to: START_BALANCE + 1, reason: "daily" },
  // A hint debits two.
  spend: { to: START_BALANCE - 2, reason: "hint" },
};

export function PeonesChipFixture({ variant }: { variant: PeonesChipVariant }) {
  const [balance, setBalance] = useState(START_BALANCE);

  useEffect(() => {
    if (variant === "balance") return;
    const move = MOVES[variant];
    const id = window.setTimeout(() => {
      // Same order as production: the sink signals, then the refetch
      // resolves to the server's new number.
      dispatchPeonesChange(move.reason);
      setBalance(move.to);
    }, MOVE_AFTER_MS);
    return () => window.clearTimeout(id);
  }, [variant]);

  return (
    <div
      style={{
        minHeight: "100dvh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        // The grass field the /exercises tray floats on, so the chip is
        // photographed against the background it actually sits over.
        background: "#489909",
        padding: "2rem 1rem",
      }}
      data-testid="peones-chip-fixture"
    >
      <PeonesBalanceChipView
        surface="exercises"
        state={{
          kind: "success",
          balance,
          dailyEarnedCapped: 0,
          dailyCap: 10,
          lastEventAt: null,
        }}
        onRefetch={() => {}}
      />
    </div>
  );
}
