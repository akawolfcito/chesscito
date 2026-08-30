"use client";

import { PlayHubScaffold } from "@/components/hub/play-hub-scaffold";
import { HubDailyTrigger } from "@/components/hub/hub-daily-trigger";
import { InboxTrigger } from "@/components/inbox/inbox-trigger";
import type { PeonesBalanceState } from "@/lib/peones/use-peones-balance";

/** Fixture variants for the PLAY hub home.
 *
 *  Why this probe exists: the PLAY hub had ZERO visual coverage. The baseline
 *  named `hub-clean — anonymous /hub` navigates to `/exercises`, and every other
 *  `hub-*` baseline belongs to the LEARN hub — so the play hub home, its dock
 *  and its CTA had never been photographed. The Coach tile lost its PRO badge on
 *  2026-07-13 with the whole suite green and nothing to catch a regression.
 *
 *  Building it is what forced the Peones chip to stop reading the wallet on its
 *  own: `usePeonesBalance` → wagmi's `useAccount` throws with no WagmiProvider
 *  above it, and the `/dev` layout mounts none on purpose. The scaffold now
 *  takes the balance as a prop, so mounting it here renders the hub — not a
 *  Next.js error overlay that Playwright would cheerfully photograph and pass
 *  (which is exactly what happened to the arena rails, 0d69e30a).
 *
 *  Every handler is a no-op: this probe photographs, it never navigates. */
export type PlayHubVariant = "guest" | "connected" | "pro";

const noop = () => {};

/** A settled balance. `loading` would render "…" and make the chip's width the
 *  only thing under test; the resting state is what ships. */
const PEONES_SETTLED: PeonesBalanceState = {
  kind: "success",
  balance: 12,
  dailyEarnedCapped: 4,
  dailyCap: 10,
  lastEventAt: null,
};

export function PlayHubFixture({ variant }: { variant: PlayHubVariant }) {
  const connected = variant !== "guest";

  return (
    <PlayHubScaffold
      mintedVictoryCount={variant === "guest" ? 0 : 3}
      isWalletConnected={connected}
      // PRO implies a connected wallet in production, so the fixture never
      // renders one without the other — a baseline of an unreachable state is a
      // baseline that lies.
      pro={variant === "pro" ? { active: true, daysRemaining: 12 } : { active: false }}
      peones={connected ? PEONES_SETTLED : { kind: "guest" }}
      /* The envelope follows the wallet, exactly as `InboxChip` does in
         production (`if (!address) return null`) — so the guest shot has no
         Inbox and the other two do. The count is IDENTICAL in both so the only
         thing moving between `connected` and `pro` stays PRO itself; a second
         variable in the same pair of images is a baseline that cannot say which
         change broke it. Before this, the fixture passed no `inboxSlot` at all
         and the vr17 baselines froze a header with no envelope in it. */
      inboxSlot={connected ? <InboxTrigger unread={2} onClick={noop} /> : undefined}
      dailySlot={
        <HubDailyTrigger
          variant="corner-icon"
          label="Daily"
          ariaLabel="Play today's Daily Tactic"
          onClick={noop}
        />
      }
      // The Kingdom panel's help chip renders only when this is defined. Omitted,
      // the probe photographed a panel with no chip while the shipped hub has one
      // — so the baseline could not see the chip's art change at all.
      onReplayTour={noop}
      onPeonesRefetch={noop}
      onConnectTap={noop}
      onTrophyTap={noop}
      onProTap={noop}
      onCoachTap={noop}
      onShopTap={noop}
      onArenaPress={noop}
    />
  );
}
