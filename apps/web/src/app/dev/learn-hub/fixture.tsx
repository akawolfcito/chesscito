"use client";

import { HubLiteScaffold } from "@/components/hub/hub-lite-scaffold";
import { HubDailyTrigger } from "@/components/hub/hub-daily-trigger";
import type { RewardTile } from "@/components/kingdom/reward-column";
import type { ContentLoopAction } from "@/lib/hub/content-loop";
import type { PeonesBalanceState } from "@/lib/peones/use-peones-balance";
import type { ChallengeProgressView } from "@/lib/season-pass/focus-days";
import type { ChallengeCardSeasonPass } from "@/components/hub/challenge-card";

/** Fixture variants for the LEARN hub home.
 *
 *  Why this probe exists: `/dev/challenge-card` photographs the card as a leaf,
 *  one state per section. It says nothing about the hub AROUND it — the HUD row,
 *  the mascot block, the card's place in the vertical stack and the Training
 *  Path underneath. That composition had zero visual coverage; the only baseline
 *  named after the hub (`hub-clean`) navigates to `/exercises`.
 *
 *  Mounting it here is only possible after `HubLiteScaffold` took `dailySlot` as
 *  a prop: `HubDailyTile` calls wagmi's `useAccount()`, and the `/dev` layout
 *  mounts no WagmiProvider on purpose — the scaffold used to render a Next.js
 *  error overlay that Playwright would cheerfully photograph and pass (which is
 *  what happened to the arena rails, 0d69e30a).
 *
 *  Nothing here reads the live catalog. `rewardTiles` is a literal, not
 *  `deriveRewardTiles()`: that helper defaults to the shipping `EXERCISES`
 *  catalog, so a tile state — and the photo — would belong to the content
 *  authors. Every handler is a no-op: this probe photographs, it never
 *  navigates. */
export type LearnHubVariant = "guest" | "active" | "pro" | "completed";

const noop = () => {};

const CHALLENGE = { challengeGoalDays: 21,
  accessDurationDays: 30, shieldBonus: 3, priceLabel: "$0.99" };

/** A settled balance. `loading` would render "…" and make the chip's width the
 *  only thing under test; the resting state is what ships. */
const PEONES_SETTLED: PeonesBalanceState = {
  kind: "success",
  balance: 12,
  dailyEarnedCapped: 4,
  dailyCap: 10,
  lastEventAt: null,
};

/** One tile per state the rail can show, so a regression in any of the four
 *  skins breaks a photo. Hand-written on purpose (see the note above). */
const REWARD_TILES: RewardTile[] = [
  { id: "rook", state: "claimed", onTap: noop },
  { id: "bishop", state: "claimable", onTap: noop },
  { id: "knight", state: "progress", onTap: noop },
  { id: "pawn", state: "locked", onTap: noop },
  { id: "queen", state: "locked", onTap: noop },
  { id: "king", state: "locked", onTap: noop },
];

type VariantShape = {
  isWalletConnected: boolean;
  trophies: number;
  peones: PeonesBalanceState;
  seasonPass: ChallengeCardSeasonPass;
  progress: ChallengeProgressView;
  passport: {
    streak: number;
    totalCompleted: number;
    todayDone: boolean;
    isLoading: boolean;
    lastCompletedDate: string | null;
  };
  shields?: { count: number };
  /** null when the pass is active (no purchase CTA). */
  hasJoinCta: boolean;
  /** The next-best-action this variant hands the CTA slot.
   *
   *  ⚠️ This used to be `null` for all three, which made every shot photograph
   *  the pre-hydration fallback — a status — and gave the VR no coverage at all
   *  of the action presentation. A `/dev` fixture photographs only what it is
   *  handed. It must stay COHERENT with `passport.todayDone`: the loop returns
   *  `daily-pending` before anything else while the Daily is pending, so a
   *  pending day paired with a terminal variant is a state the product cannot
   *  reach. */
  contentLoop: ContentLoopAction;
};

/** Minimal action for the probe. The copy fields are never read by the slot
 *  (labels resolve through next-intl by key), so they carry the loop's own
 *  strings unchanged rather than a second set to keep in sync. */
function loopAction(
  variant: ContentLoopAction["variant"],
  destination: string | null,
): ContentLoopAction {
  return {
    variant,
    destination,
    ctaEN: "",
    ctaES: "",
    subEN: "",
    subES: "",
  };
}

const VARIANTS: Record<LearnHubVariant, VariantShape> = {
  // No wallet: the Peones chip is absent and the Connect chip takes its place.
  // The card falls back to `offer` — with nothing recorded, there is no number
  // to show.
  guest: {
    isWalletConnected: false,
    trophies: 0,
    peones: { kind: "guest" },
    seasonPass: { active: false, isLoading: false },
    progress: { state: "offer" },
    passport: {
      streak: 0,
      totalCompleted: 0,
      todayDone: false,
      isLoading: false,
      lastCompletedDate: null,
    },
    hasJoinCta: true,
    // Never reached: without an active pass the slot is the $0.99 banner. Kept
    // coherent anyway so the fixture never encodes an impossible state.
    contentLoop: loopAction("daily-pending", "/exercises?slot=daily"),
  },
  // The widest ordinary case, and the row most likely to break at 390px: a
  // two-digit progress, a two-digit countdown and a two-digit streak, all in
  // one line.
  active: {
    isWalletConnected: true,
    trophies: 3,
    peones: PEONES_SETTLED,
    seasonPass: { active: true, source: "season_pass", shieldsCredited: 3 },
    progress: {
      state: "active",
      progress: { completed: 12, goal: 21 },
      window: { kind: "expiring", daysRemaining: 10 },
      streak: 12,
      unreachable: false,
    },
    passport: {
      streak: 12,
      totalCompleted: 12,
      todayDone: true,
      isLoading: false,
      lastCompletedDate: "2026-04-25",
    },
    shields: { count: 3 },
    hasJoinCta: false,
    // Day done and nothing actionable left: the TERMINAL presentation. This is
    // the shot that proves the legend keeps the button's reserved box — the
    // anchor where the CLS 0,179 lived until 2026-08-07.
    contentLoop: loopAction("come-back-tomorrow", null),
  },
  // PRO reaches the challenge without buying a window: `unbounded` renders no
  // countdown at all, and the crowned badge is the only thing that says why
  // (founder, 2026-07-27 — the two used to say it twice).
  pro: {
    isWalletConnected: true,
    trophies: 5,
    peones: PEONES_SETTLED,
    seasonPass: { active: true, source: "pro" },
    progress: {
      state: "active",
      progress: { completed: 6, goal: 21 },
      window: { kind: "unbounded" },
      streak: 6,
      unreachable: false,
    },
    passport: {
      streak: 6,
      totalCompleted: 6,
      todayDone: false,
      isLoading: false,
      lastCompletedDate: "2026-04-24",
    },
    shields: { count: 2 },
    hasJoinCta: false,
    // Daily still pending → the ACTION presentation, a real button. Coherent
    // with `todayDone: false` above.
    contentLoop: loopAction("daily-pending", "/exercises?slot=daily"),
  },
  /* The finished 21-day challenge (Sprint 1.5). This state used to spend the
     CTA slot announcing itself, and `completed` is terminal — so the most
     committed player in the product lost their next action permanently. The
     shot exists to prove two things at once: the chip says COMPLETED, and the
     slot still offers something to do. */
  completed: {
    isWalletConnected: true,
    trophies: 7,
    peones: PEONES_SETTLED,
    seasonPass: { active: true, source: "season_pass", shieldsCredited: 3 },
    progress: {
      state: "completed",
      progress: { completed: 21, goal: 21 },
      window: { kind: "expiring", daysRemaining: 4 },
      streak: 21,
    },
    passport: {
      streak: 21,
      totalCompleted: 21,
      todayDone: true,
      isLoading: false,
      lastCompletedDate: "2026-04-25",
    },
    shields: { count: 3 },
    hasJoinCta: false,
    // Day done, challenge finished, stars still improvable: the loop keeps
    // producing work. Coherent with `todayDone: true`.
    contentLoop: loopAction("improve-stars", "/exercises?piece=rook"),
  },
};

export function LearnHubFixture({ variant }: { variant: LearnHubVariant }) {
  const v = VARIANTS[variant];

  return (
    <HubLiteScaffold
      trophies={v.trophies}
      isWalletConnected={v.isWalletConnected}
      peones={v.peones}
      onPeonesRefetch={noop}
      onConnectTap={v.isWalletConnected ? null : noop}
      onTrophyTap={noop}
      focusPassport={v.passport}
      challenge={CHALLENGE}
      seasonPass={v.seasonPass}
      progress={v.progress}
      onJoinChallenge={v.hasJoinCta ? noop : null}
      dailySlot={
        <HubDailyTrigger
          variant="corner-icon"
          label="Daily"
          ariaLabel="Play today's Daily Tactic"
          onClick={noop}
        />
      }
      onPassportTap={noop}
      // See the PLAY probe: the challenge card's help chip renders only when this
      // is defined, so without it the baseline is blind to the chip.
      onReplayTour={noop}
      shields={v.shields}
      primaryFocus={{ onPress: noop, contentLoop: v.contentLoop, isHydrated: true }}
      rewardTiles={REWARD_TILES}
      isPro={variant === "pro"}
      onAccountTap={noop}
    />
  );
}
