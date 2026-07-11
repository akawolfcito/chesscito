"use client";

import { useState } from "react";

import { VictoryPopupShell } from "@/components/arena/victory-popup-shell";
import {
  CELEBRATION_PANEL_BG,
  SeasonPassCelebration,
} from "@/components/payments/season-pass-celebration";
import { getSeasonPass } from "@/lib/payments/rail-config";

export type CelebrationVariant = "credited" | "pending";

/** Shields the celebration was handed by the verified receipt. `pending` is the
 *  real path where the payment settled but the Redis grant did not
 *  (`verify-payment` answers 0) — the one a founder can never reach on demand
 *  with a live purchase, which is the whole point of this probe. */
const SHIELDS: Record<CelebrationVariant, number> = {
  credited: 3,
  pending: 0,
};

export function SeasonPassCelebrationFixture({
  variant,
}: {
  variant: CelebrationVariant;
}) {
  const pass = getSeasonPass("lite_season_pass_21");
  const [replay, setReplay] = useState(0);

  return (
    <div className="min-h-dvh">
      {/* Remounts the celebration so the confetti burst replays — the
          animation is `both`-filled and otherwise only fires on mount. */}
      <button
        type="button"
        onClick={() => setReplay((n) => n + 1)}
        className="fixed left-3 top-3 z-[80] rounded-md bg-black/70 px-3 py-1.5 text-xs font-bold text-white"
      >
        Replay confetti
      </button>

      <VictoryPopupShell
        key={replay}
        onClose={() => {}}
        ariaLabel="21-Day Mind Challenge Pass"
        closeLabel="Close"
        panelBackgroundImage={CELEBRATION_PANEL_BG}
      >
        <SeasonPassCelebration
          durationDays={pass.durationDays}
          shieldsCredited={SHIELDS[variant]}
          onStartFocus={() => {}}
        />
      </VictoryPopupShell>
    </div>
  );
}
