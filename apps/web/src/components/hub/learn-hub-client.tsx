"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { useConnectWallet } from "@/lib/wallet/use-connect-wallet";
import { usePeonesBalance } from "@/lib/peones/use-peones-balance";

import { HubScaffold } from "@/components/hub/hub-scaffold";
const BadgeSheet = dynamic(
  () => import("@/components/exercises/badge-sheet").then((m) => m.BadgeSheet),
  { ssr: false },
);
const PurchaseConfirmSheet = dynamic(
  () =>
    import("@/components/exercises/purchase-confirm-sheet").then(
      (m) => m.PurchaseConfirmSheet,
    ),
  { ssr: false },
);
const ShopSheet = dynamic(
  () => import("@/components/exercises/shop-sheet").then((m) => m.ShopSheet),
  { ssr: false },
);
const ProSheet = dynamic(
  () => import("@/components/pro/pro-sheet").then((m) => m.ProSheet),
  { ssr: false },
);
import { ProfileSheet } from "@/components/profile/profile-sheet";
import { SettingsSheetStub } from "@/components/hub/settings-sheet-stub";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { ContextualHeader } from "@/components/ui/contextual-header";
import { useBadgeSheetState } from "@/lib/badges/use-badge-sheet-state";
import { useShopSheetState } from "@/lib/shop/use-shop-sheet-state";
import { useClaimQueue } from "@/hooks/use-claim-queue";
import { useProSheetState } from "@/lib/pro/use-pro-sheet-state";
import {
  proDisplayState,
  useProEntitlement,
} from "@/lib/pro/use-is-pro-active";
import { applyDevUnlock } from "@/lib/daily/session-quota";
import { useShieldSync } from "@/lib/shop/use-shield-sync";
import { useAccount } from "wagmi";
import type { PieceId } from "@/lib/game/types";
import { useLabyrinthCatalog } from "@/lib/content/catalog-context";
import { SPECIAL_TRAINING_ROOK_STARS } from "@/lib/progression/milestones";
import { startFocusExerciseDestination } from "@/lib/hub/content-loop";
import { resolveCtaTap } from "@/lib/hub/cta-tap";
import {
  isMilestoneSeedReady,
  useMilestoneSeeding,
} from "@/lib/progression/use-milestone-seeding";
import { track } from "@/lib/telemetry";
import { deriveRewardTiles } from "@/lib/hub/derive-reward-tiles";
import { MiniGamesSlot } from "@/components/hub/minigames-slot";
import { InboxChip } from "@/components/inbox/inbox-chip";
import {
  CHESSCITO_LITE_MODE,
  isSeasonPassSalesEnabled,
} from "@/lib/feature-flags";
import { useHubData } from "@/components/hub/use-hub-data";
import { HubDailyTile } from "@/components/hub/hub-daily-tile";
import { getAnonymousId } from "@/lib/analytics/identity";
import { getDailyTactic } from "@/lib/daily/daily-puzzles";
import { todayUtc } from "@/lib/daily/progress";
import {
  decideFirstActivity,
  type OnboardingVariant,
} from "@/lib/onboarding/first-activity-experiment";
import {
  emitOnboardingActivityFailed,
  emitOnboardingActivityReady,
  emitOnboardingActivityRequested,
  emitOnboardingClosureShown,
  emitOnboardingFallbackToHub,
  emitOnboardingHubReached,
  emitOnboardingVariantAssigned,
} from "@/lib/onboarding/telemetry";
import {
  useLearnFocusDays,
  type DailyProgressState,
} from "@/lib/season-pass/use-learn-focus-days";
import { useFocusDayRecorder } from "@/lib/season-pass/use-focus-day-recorder";
import { buildChallengeProgressView } from "@/lib/season-pass/challenge-card-view";
import { HubLiteScaffold } from "@/components/hub/hub-lite-scaffold";
const SeasonPassSheet = CHESSCITO_LITE_MODE
  ? dynamic(
      () => import("@/components/payments/season-pass-sheet").then((m) => m.SeasonPassSheet),
      { ssr: false },
    )
  : () => null;

export type HubInitialSheet =
  | "shop"
  | "pro"
  | "badges"
  | "trophies"
  | "profile"
  | "settings";

export type HubScaffoldClientProps = {
  initialSheet?: HubInitialSheet;
};

function premiumAriaLabel(
  pro: { active: true; daysRemaining: number } | { active: false },
  used: number,
  total: number,
  t: ReturnType<typeof useTranslations<"HUB_SCAFFOLD_COPY">>,
) {
  if (!pro.active) {
    return t("premiumInactiveAriaLabel");
  }
  return t("premiumActiveAriaFormat", {
    used,
    total,
    days: pro.daysRemaining,
  });
}

/** The LEARN hub, mounted at `/` whenever `CHESSCITO_MODE !== "play"`.
 *  (Was `LegacyHubClient`: the name predated the LEARN/PLAY split and read
 *  as a dead surface. PLAY's hub is `PlayHubClient`.)
 *
 *  Client-side container that hydrates `<HubScaffold>` with real data:
 *  - Trophies: count of claimed badges (Badges contract, batched read).
 *  - PRO chip: `useProStatus(address)` shape + days-remaining math.
 *  - Reward tiles: `deriveRewardTiles({ badgesClaimed, starsPerPiece })`.
 *  - Tap handlers: routed to existing destinations (`/trophies` for the
 *    trophy chip, `/hub` legacy for the rest) until the flag flip in
 *    Story 1.12 final replaces them with in-scaffold sheets.
 *
 *  Pure presentational composition — no on-chain mutations belong here.
 *  Those stay on `<ExercisesScreen>` until the scaffold becomes the default. */
export function LearnHubClient({
  initialSheet,
}: HubScaffoldClientProps) {
  const tHud = useTranslations("HUD_COPY");
  const tScaffold = useTranslations("HUB_SCAFFOLD_COPY");
  const tSettings = useTranslations("SETTINGS_STUB_COPY");
  const router = useRouter();
  // Read-only hub data (wallet, trophies, stars/shields, Lite
  // passport/content-loop/quota/season) is hydrated by useHubData and
  // destructured into the original local names so the handlers + JSX below
  // are unchanged. `shared.hero` / `lite.challenge` are produced for the Lite
  // presenter (PR B) and intentionally not consumed by the Full render here.
  const { shared, lite } = useHubData();
  const { address, isConnected, trophies, badgesClaimed, starsPerPiece, completedPerPiece, starsByIdPerPiece, isProgressHydrated, shieldCount } = shared;
  const { focusPassport, contentLoop, sessionQuota } = lite;
  const seasonPassStatus = lite.seasonPass;
  const contentLoopAction = contentLoop.action;
  const isContentLoopHydrated = contentLoop.isHydrated;
  const contentLoopPrimaryPiece = contentLoop.primaryPiece;
  const sessionQuotaState = sessionQuota;
  // Direct injected connect (RainbowKit removed, P2 2026-06-12). In
  // MiniPay the auto-connect in <WalletProvider> wins before this CTA
  // ever renders; on desktop it triggers the extension prompt.
  const { connectWallet } = useConnectWallet();

  // The scaffold takes no hooks (its docstring says so). The Peones chip used
  // to break that promise from two levels down; the read lives here now.
  const peones = usePeonesBalance();

  // PRO sheet orchestration. Owns its own status fetch internally so
  // we don't double-fetch /api/pro/status from this surface.
  const proSheet = useProSheetState();
  const proStatus = proSheet.proStatus;
  const entitlement = useProEntitlement();

  // BadgeSheet orchestration — claim flow + on-chain reads. Reward tile
  // taps open this sheet in-place (port 2026-05-07) instead of bouncing
  // through `?legacy=1&action=badges`. Solves audit B7 by giving every
  // piece tap a real destination (the sheet itself) rather than the
  // collapsed legacy view that dropped the piece query for queen/king.
  const badgeSheet = useBadgeSheetState();

  // Shop orchestration — same in-place pattern as PRO/Badges. Removes
  // the last `?legacy=1&action=shop` round-trip. Hook owns catalog +
  // balances + approve/buy + post-submit server credit; scaffold just
  // mounts the two sheets it returns.
  const shopSheet = useShopSheetState({
    onSelectProItem: () => proSheet.openSheet(),
  });
  const openBadgeSheet = badgeSheet.openSheet;
  const openProSheet = proSheet.openSheet;
  const openShopSheet = shopSheet.openSheet;
  const initialSheetOpenedRef = useRef(false);
  const proTrainingCardViewedRef = useRef(false);

  // SPEC 1 D9/D10 wiring — Profile sheet, Settings stub.
  // Lite Mode: deep-link ?sheet=profile must not open ProfileSheet (it mounts ProSheet).
  const [profileOpen, setProfileOpen] = useState(!CHESSCITO_LITE_MODE && initialSheet === "profile");
  const [settingsOpen, setSettingsOpen] = useState(initialSheet === "settings");
  const [seasonPassSheetOpen, setSeasonPassSheetOpen] = useState(false);
  // The Learn daily is CONTROLLED from here: the corner gift and the Focus
  // Passport must open one instance, not two. The scaffold used to own this
  // state, which forced it to mount `HubDailyTile` (and its `useAccount()`)
  // itself — see `dailySlot` in hub-lite-scaffold.tsx.
  const [dailyOpen, setDailyOpen] = useState(false);
  // Focus Days. The LEARN-only read (never the global entitlement provider,
  // which must not wait on the Daily's localStorage) plus the pure assembler.
  const dailyProgressState = useMemo<DailyProgressState>(
    () =>
      focusPassport
        ? focusPassport.isLoading
          ? { status: "loading" }
          : {
              status: "ready",
              value: {
                streak: focusPassport.streak,
                lastCompletedDate: focusPassport.lastCompletedDate ?? null,
              },
            }
        : { status: "loading" },
    [focusPassport],
  );
  // The write and the read are separate calls, and the write lands second: the
  // reader re-counts on this token, or the number a player just earned stays
  // frozen until the next mount.
  const [focusDaysToken, setFocusDaysToken] = useState(0);
  const focusDaysSlice = useLearnFocusDays({
    wallet: address,
    entitlementActive: seasonPassStatus.active,
    dailyProgress: dailyProgressState,
    refreshToken: focusDaysToken,
  });
  useFocusDayRecorder({
    wallet: address,
    entitlementActive: seasonPassStatus.active,
    dailyProgress: dailyProgressState,
    onRecorded: useCallback(() => setFocusDaysToken((n) => n + 1), []),
  });
  const challengeProgress = useMemo(
    () =>
      buildChallengeProgressView({
        entitlement: seasonPassStatus.loading
          ? { status: "loading" }
          : seasonPassStatus.active && seasonPassStatus.source
            ? {
                status: "active",
                source: seasonPassStatus.source,
                seasonPassExpiresAt: seasonPassStatus.seasonPassExpiresAt,
                /* PRO expires too. Passing it is what stops the challenge from
                   telling a PRO holder the 21 days are reachable when their
                   subscription runs out first (see focusWindow). Stored as
                   epoch ms upstream; the view speaks ISO like the pass does. */
                /* ⛔ Number.isFinite, not `!== null`. `toISOString()` THROWS
                   on a non-finite value, and this runs inside a useMemo during
                   render — a corrupt timestamp took the whole Learn hub down
                   with a RangeError instead of degrading to "no deadline".
                   Caught by learn-hub-client-focus-day-recorder.test. */
                proExpiresAt: Number.isFinite(seasonPassStatus.proExpiresAt)
                  ? new Date(seasonPassStatus.proExpiresAt as number).toISOString()
                  : null,
              }
            : { status: "none" },
        // Suppresses only the OFFER. An entitlement someone already paid for
        // is untouched — see isSeasonPassSalesEnabled.
        salesPaused: !isSeasonPassSalesEnabled(),
        slice: focusDaysSlice.status === "idle" || focusDaysSlice.status === "loading"
          ? null
          : focusDaysSlice,
        streak: focusPassport?.streak ?? 0,
        nowMs: Date.now(),
      }),
    [seasonPassStatus, focusDaysSlice, focusPassport],
  );
  // `useClaimQueue` reads pending claims out of localStorage on mount;
  // the unread count drives the avatar notif-dot once the HUD slot
  // exists (deferred — see project note).
  useClaimQueue(address);

  useEffect(() => {
    if (!initialSheet || initialSheetOpenedRef.current) return;
    initialSheetOpenedRef.current = true;
    if (!CHESSCITO_LITE_MODE) {
      if (initialSheet === "shop") {
        openShopSheet();
      } else if (initialSheet === "pro") {
        openProSheet();
      } else if (initialSheet === "badges") {
        openBadgeSheet();
      }
    }
    if (initialSheet === "trophies") {
      // External deep-link → the standalone /trophies page (SPEC 1 D8).
      router.push("/trophies");
    }
    // profile + settings open synchronously via the useState init above.
  }, [initialSheet, openBadgeSheet, openProSheet, openShopSheet, router]);

  // Boot-time + post-purchase shield reconciliation. Drains the
  // pending-tx queue, runs one-shot legacy migration, refreshes
  // credited-cache via /api/shields/me. Mounted at the scaffold root
  // so the chip sees server-confirmed state on every connect.
  useShieldSync();

  /**
   * The one-time milestone migration (Task 15). Mounted here AND on the
   * exercises screen — never here alone. `resolve()` lives on the exercises
   * screen and a player can deep-link straight to it, so the hub can never be
   * the only seeding surface (that is the single-writer shape that produced the
   * shield credited-cache bug, PR #213). `seedMilestonesOnce` is guarded by a
   * persistent marker, so whichever surface mounts first pays for it and the
   * other is a no-op.
   *
   * Ready when the badge state is KNOWN: `disconnected` reads as "no badges",
   * exactly what a resolve would see; `connecting` / `reconnecting` waits, so
   * we never mark a profile migrated with `piece-badge-claimed` unseeded.
   *
   * An UNSUPPORTED chain never becomes ready — `getBadgesAddress` is null
   * there, the batched read stays disabled and `badgesClaimed` stays empty, so
   * this gate holds false for as long as the player stays on that chain. That
   * is deliberate and it matches the exercises screen: an unknown badge state
   * is NOT "no badges". The other half of the contract lives where `resolve()`
   * does — `resolveMilestones` refuses to run while the profile is unseeded,
   * so an unseeded player cannot be handed a retroactive parade in the
   * meantime. The hub never resolves; it only seeds.
   */
  const { status: accountStatus } = useAccount();
  const labyrinthCatalog = useLabyrinthCatalog();
  const labyrinthIdsByPiece = useMemo(() => {
    const out: Partial<Record<PieceId, string[]>> = {};
    for (const [piece, labs] of Object.entries(labyrinthCatalog)) {
      out[piece as PieceId] = labs.map((lab) => lab.id);
    }
    return out;
  }, [labyrinthCatalog]);
  useMilestoneSeeding({
    // The SAME gate the exercises screen uses. `badgesClaimed` is empty until
    // the batched on-chain read answers — and on an unsupported chain it never
    // does, which is precisely when we must not seed.
    ready: isMilestoneSeedReady({
      accountStatus,
      badgeStateKnown: Object.keys(badgesClaimed).length > 0,
    }),
    badgeClaimedByPiece: badgesClaimed,
    labyrinthIdsByPiece,
    giftAvailable: CHESSCITO_LITE_MODE,
  });

  const pro = proDisplayState(entitlement);

  // Lite B1.2 — one-per-tab session start event for grant dashboard.
  // sessionStorage dedupe ensures refresh doesn't double-count.
  useEffect(() => {
    if (!CHESSCITO_LITE_MODE) return;
    const SESSION_KEY = "chesscito:lite-session-started";
    try {
      if (!sessionStorage.getItem(SESSION_KEY)) {
        sessionStorage.setItem(SESSION_KEY, "1");
        track("lite_session_started", { isLite: true });
      }
    } catch {
      // sessionStorage unavailable (private mode / WebView) — skip dedupe, emit once.
      track("lite_session_started", { isLite: true });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleArenaPress = useCallback(() => {
    if (CHESSCITO_LITE_MODE) return;
    track("secondary_arena_clicked");
    // `?fresh=1` forces the arena page to show the difficulty + color
    // selector. Without it the route auto-resumes the previous match
    // (or falls onto the default difficulty), which surprised users
    // tapping the Hub's ENTER ARENA CTA expecting to configure a new
    // run. Same param used by every other arena entry point (Hub
    // dock, Coach history Play Again, Trophies, victory accept).
    router.push("/arena?fresh=1");
  }, [router]);

  // Single page-view event per mount — anchors the funnel for every
  // tap event below. Empty deps so we never double-fire on re-render.
  // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional once-per-mount
  useEffect(() => {
    track("hub_view");
  }, []);

  useEffect(() => {
    if (CHESSCITO_LITE_MODE) return;
    if (proTrainingCardViewedRef.current) return;
    if (isConnected && proStatus === null) return;
    proTrainingCardViewedRef.current = true;
    track("pro_training_card_viewed", {
      surface: "hub",
      pro_active: pro.active,
      wallet_connected: isConnected,
      cta: pro.active ? "training_journal" : "open_pro_sheet",
    });
    // M1 funnel (Commit 6, 2026-06-02) — monetization-namespaced view
    // event for the Hub chip surface. Mirrors the legacy training_card
    // gate (once per mount, once status resolves) so the funnel rolls
    // up cleanly without duplicate counting on re-renders.
    track("monetization.pro_chip_view", {
      active: pro.active,
      daysRemaining: pro.active ? pro.daysRemaining : null,
    });
    // Anti-spam expiring nudge — fires at most once per session per
    // (wallet, expiresAt) pair so a renewal mid-session can re-arm the
    // event for the NEW expiresAt without overwriting the same key.
    if (pro.active && pro.daysRemaining <= 7 && address && proStatus?.expiresAt) {
      const storageKey = "chesscito:pro-expiring-chip-shown";
      const sessionValue = `${address.toLowerCase()}:${proStatus.expiresAt}`;
      try {
        const previous = window.sessionStorage.getItem(storageKey);
        if (previous !== sessionValue) {
          window.sessionStorage.setItem(storageKey, sessionValue);
          track("monetization.pro_expiring_view", {
            daysRemaining: pro.daysRemaining,
          });
        }
      } catch {
        // sessionStorage can throw in private-mode iframes; fail open
        // and ship the event anyway so we don't lose the signal.
        track("monetization.pro_expiring_view", {
          daysRemaining: pro.daysRemaining,
        });
      }
    }
  }, [
    address,
    isConnected,
    pro,
    proStatus,
  ]);

  const rewardTiles = useMemo(() => {
    const tiles = deriveRewardTiles({
      badgesClaimed,
      completedPerPiece,
      starsByIdPerPiece,
      isHydrated: isProgressHydrated,
    });
    return tiles.map((tile) => ({
      ...tile,
      onTap: () => {
        track("hub_reward_tile_tap", { piece: tile.id, state: tile.state });
        if (tile.state === "locked") {
          return;
        }
        router.push(`/exercises?piece=${tile.id}`);
      },
    }));
  }, [badgesClaimed, completedPerPiece, starsByIdPerPiece, isProgressHydrated, router]);
  // The shields chip is the home for shop conversion (the user's primary
  // monetization surface). Always visible whether the count is 0 or N —
  // a depleted "Shield ×0" is the strongest replenishment cue.
  const shieldsValue = shieldCount;

  // <ChallengeCard> requires a non-null passport; Lite always hydrates one
  // (useHubData), but fall back to the loading shell defensively so the card
  // never receives undefined.
  const liteFocusPassport = focusPassport ?? {
    streak: 0,
    totalCompleted: 0,
    todayDone: false,
    lastCompletedDate: null,
    isLoading: true,
  };

  // Live shields balance for the ChallengeCard chip — the same counter the
  // HUD chip reads, so the two can never disagree.
  const liteShields = useMemo(() => ({ count: shieldsValue }), [shieldsValue]);

  // The Hub Tour (LEARN only). Held back until BOTH signals it narrates have
  // resolved — the daily's todayDone and the season pass — because its copy is
  // the product decision: a player who already holds the pass is never sold it
  // again, and one who already solved today's daily is pointed at tomorrow.
  /* ⛔ The tour → first-activity experiment lived here and was removed with
   * the tour that triggered it (2026-08-30). See the note above the return:
   * its variant dropped a player into the Daily because the control landed on
   * a grid of choices, and that grid no longer exists — the treatment became
   * the control, so the arms stopped differing.
   *
   * `first-activity-experiment.ts` stays with its pure unit tests: the
   * assignment function is still correct, it simply has no caller. Retire the
   * module in its own pass, not inside a layout change. */
  /* ⛔ THE LEARN MINI-TOUR IS REMOVED (2026-08-30), and with it the
   * first-activity experiment it triggered.
   *
   * The tour arbitrated between three things competing for attention — the
   * Daily, the Season Pass and Exercises. Its Season Pass step already skipped
   * itself while sales are paused (`skipChallengeStep`), Exercises became the
   * dominant purple CTA, and the flame strip explains itself. One step was
   * left, and a one-step tour is not a tour.
   *
   * ⛔ The surviving step had nothing to add either: the header gift ALREADY
   * pulses while the Daily is pending (`.hub-lite-daily-anchor.is-pending`).
   * A permanent behavioural cue beats a one-time modal — it is there every day
   * and costs nobody a tap to dismiss.
   *
   * ⛔ WHY THE EXPERIMENT GOES WITH IT, at a live 50% rollout. Its hypothesis
   * was "a player who finishes the tour and lands on A GRID OF CHOICES leaves
   * without doing anything", and its variant dropped them into the Daily
   * instead. That grid no longer exists: the control now lands on one purple
   * CTA. **The treatment became the control**, so the arms stopped differing
   * and any further data would mix two populations with different controls.
   * What it already collected stays valid; what it would collect from here
   * does not.
   *
   * ⚠️ Nobody is stranded. The tour showed once per install and wrote its own
   * key, so every install already assigned has already resolved. This stops
   * recruitment, it does not revoke anyone.
   *
   * ⚠️ `NEXT_PUBLIC_ONBOARDING_FIRST_ACTIVITY_PCT` is still 50 in production —
   * set it to 0 so the flag matches the code.
   *
   * `buildLearnHubTourSteps` and `HubTour` both stay: PLAY's tour is gone but
   * the component ships, and the builder keeps its own unit tests. */

  return (
    <>
      {CHESSCITO_LITE_MODE ? (
        <HubLiteScaffold
          isWalletConnected={isConnected}
          peones={peones.state}
          onPeonesRefetch={() => void peones.refetch()}
          onConnectTap={
            isConnected
              ? null
              : () => {
                  track("hub_connect_chip_tap");
                  connectWallet();
                }
          }
          focusPassport={liteFocusPassport}
          challenge={lite.challenge}
          shields={liteShields}
          compactPassport
          seasonPass={lite.challengeSeasonPass}
          progress={challengeProgress}
          dailySlot={
            <HubDailyTile
              variant="corner-icon"
              open={dailyOpen}
              onOpenChange={setDailyOpen}
            />
          }
          onPassportTap={() => setDailyOpen(true)}
          onJoinChallenge={
            // Same gate as the legacy season-pass CTA: never offer the buy
            // flow while status resolves or to an existing pass holder.
            !seasonPassStatus.loading && !seasonPassStatus.active
              ? () => setSeasonPassSheetOpen(true)
              : null
          }
          primaryFocus={{
            // Where it goes and what it reports are decided in `resolveCtaTap`,
            // not here: two copies of those rules is two chances to disagree,
            // and this container cannot be unit-tested without the whole hub.
            onPress: (destination: string) => {
              const variant = contentLoopAction?.variant;
              if (!variant) return;

              const tap = resolveCtaTap({
                variant,
                destination,
                legacyDestination: startFocusExerciseDestination(contentLoopPrimaryPiece),
              });

              track(tap.event, tap.props);
              router.push(tap.target);
            },
            contentLoop: contentLoopAction,
            isHydrated: isContentLoopHydrated,
          }}
          miniGamesSlot={<MiniGamesSlot />}
          // The chip reads the wallet itself, so it is built here and handed
          // down as a node: the scaffold stays hook-free.
          inboxSlot={<InboxChip />}
          rewardTiles={rewardTiles}
          /* The ONE door to the exercise path. It lands on the player's primary
             piece through `startFocusExerciseDestination` — the SAME resolver
             the ChallengeCard's CTA uses for its legacy destination, so the two
             ways into the path from this screen cannot disagree about which
             piece is next. A bare `/exercises` would re-open whatever piece the
             screen last stored, which is not the same question. */
          onOpenExercisePath={() => {
            track("hub_exercises_entry_tap", {
              piece: contentLoopPrimaryPiece,
              hydrated: isContentLoopHydrated,
            });
            router.push(startFocusExerciseDestination(contentLoopPrimaryPiece));
          }}
          isPro={entitlement.active}
          onAccountTap={() => {
            track("hub_account_chip_tap");
            router.push("/exercises?sheet=account");
          }}
        />
      ) : (
      <HubScaffold
        trophies={trophies}
        pro={pro}
        shields={null}
        isWalletConnected={isConnected}
        onConnectTap={() => {
          track("hub_connect_chip_tap");
          connectWallet();
        }}
        rewardTiles={rewardTiles}
        premiumKicker={tScaffold("premiumKicker")}
        premiumInactiveLabel={tScaffold("premiumInactiveLabel")}
        premiumProgressFormat={(current: number, total: number) =>
          tHud("starsFormat", { current, total })
        }
        premiumAriaLabel={premiumAriaLabel(pro, 0, 0, tScaffold)}
        premiumUsed={0}
        premiumTotal={0}
        playLabel={tScaffold("playLabel")}
        playAriaLabel={tScaffold("playAriaLabel")}
        onTrophyTap={() => {
          track("hub_trophy_tap", { count: trophies });
          // Direct route to /trophies instead of legacy round-trip.
          // Same TrophiesBody renders, no bounce loop, deep-linkable.
          router.push("/trophies");
        }}
        onProTap={CHESSCITO_LITE_MODE ? undefined : () => {
          track("hub_pro_chip_tap", { pro_active: pro.active });
          // M1 funnel (Commit 6) — monetization-namespaced tap with
          // daysRemaining payload, parallel to the legacy event.
          track("monetization.pro_chip_tap", {
            active: pro.active,
            daysRemaining: pro.active ? pro.daysRemaining : null,
          });
          // In-place ProSheet (port 2026-05-07). Kills the legacy
          // ?legacy=1&action=pro round-trip + the B2 nav race that
          // bounce caused; sheet renders directly above the scaffold.
          proSheet.openSheet();
        }}
        onCoachTap={CHESSCITO_LITE_MODE ? undefined : () => {
          track("hub_coach_chip_tap", { pro_active: pro.active });
          if (pro.active) {
            router.push("/coach/history");
          } else {
            proSheet.openSheet();
          }
        }}
        onProTilePress={CHESSCITO_LITE_MODE ? undefined : () => {
          track("hub_pro_tile_tap", { pro_active: pro.active });
          proSheet.openSheet();
        }}
        onPremiumTap={CHESSCITO_LITE_MODE ? undefined : () => {
          track("hub_premium_slot_tap", { pro_active: pro.active });
          proSheet.openSheet();
        }}
        onShieldsTap={CHESSCITO_LITE_MODE ? undefined : () => {
          // KEY conversion event: validates the monetization-as-default
          // hypothesis behind the scaffold redesign. Shield count carried
          // as a dim so we can correlate tap rate with depletion state.
          track("hub_shields_chip_tap", { shield_count: shieldCount });
          // In-place ShopSheet (port 2026-05-08). Closes the last
          // `?legacy=1&action=shop` round-trip. PurchaseConfirmSheet
          // and the success banner are owned by `useShopSheetState`.
          shopSheet.openSheet();
        }}
        secondaryAction={{
          label: tHud("practiceLinkLabel"),
          ariaLabel: tHud("practiceLinkAriaLabel"),
          onPress: () => {
            track("hub_practice_link_tap");
            router.push("/exercises");
          },
        }}
        onArenaPress={handleArenaPress}
        // Single-sourced with the milestone that celebrates this exact tile.
        // A hardcoded 12 here would let the threshold and its own celebration
        // drift apart the day the milestone moves.
        miniArenaUnlocked={
          (starsPerPiece.rook ?? 0) >= SPECIAL_TRAINING_ROOK_STARS
        }
      />
      )}
      {process.env.NODE_ENV === "development" &&
        CHESSCITO_LITE_MODE &&
        sessionQuotaState?.isAtFreeLimit &&
        !sessionQuotaState.isAtHardMax ? (
          <button
            type="button"
            onClick={() => { applyDevUnlock(); }}
            style={{
              position: "fixed",
              bottom: "calc(env(safe-area-inset-bottom, 0px) + 72px)",
              right: 16,
              background: "rgba(180,0,180,0.9)",
              color: "#fff",
              padding: "8px 14px",
              borderRadius: 20,
              fontSize: 12,
              fontWeight: 700,
              zIndex: 9999,
            }}
          >
            Dev: +5 mock unlock
          </button>
        ) : null}
      {!CHESSCITO_LITE_MODE && <ProSheet {...proSheet.sheetProps} />}
      {!CHESSCITO_LITE_MODE && <BadgeSheet {...badgeSheet.sheetProps} />}
      {!CHESSCITO_LITE_MODE && <ShopSheet {...shopSheet.sheetProps} />}
      {!CHESSCITO_LITE_MODE && <PurchaseConfirmSheet {...shopSheet.confirmProps} />}
      {CHESSCITO_LITE_MODE && (
        <SeasonPassSheet
          open={seasonPassSheetOpen}
          onOpenChange={setSeasonPassSheetOpen}
          // Refresh the entitlement but LEAVE THE SHEET OPEN: the verified
          // payment renders the celebration, and closing here would unmount it
          // in the same tick the rail reaches "success". The user dismisses it
          // via Start Focus or the X.
          onSuccess={() => {
            void seasonPassStatus.refresh();
          }}
        />
      )}
      <ProfileSheet open={profileOpen} onOpenChange={setProfileOpen} />
      <Sheet open={settingsOpen} onOpenChange={setSettingsOpen}>
        <SheetContent
          side="bottom"
          hideClose
          title={tSettings("title")}
          className="settings-sheet"
        >
          <div className="-mx-6 -mt-6 border-b border-[rgba(110,65,15,0.30)] pt-[calc(env(safe-area-inset-top)+0.25rem)]">
            <ContextualHeader
              variant="close-control"
              title={tSettings("title")}
              close={{ onClick: () => setSettingsOpen(false), label: tSettings("closeAriaLabel") }}
            />
          </div>
          <SettingsSheetStub buildSha={process.env.NEXT_PUBLIC_BUILD_SHA ?? "dev"} />
        </SheetContent>
      </Sheet>
    </>
  );
}
