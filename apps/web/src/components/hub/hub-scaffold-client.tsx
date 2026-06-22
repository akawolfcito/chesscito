"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { useAccount, useChainId, useReadContracts } from "wagmi";
import { useConnectWallet } from "@/lib/wallet/use-connect-wallet";

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
import {
  getHeroContextAction,
  type HeroContextState,
} from "@/lib/hub/hero-cta";
import {
  deriveContentLoopAction,
  LITE_PRIMARY_PIECE,
  type ContentLoopAction,
} from "@/lib/hub/content-loop";
import { buildTrainingPath } from "@/lib/training/path";
import { getLabyrinthBestsMap } from "@/lib/game/labyrinth-progress";
import { useWelcomePackage } from "@/lib/welcome-package/use-welcome-package";
import { getExercisesCompletedCount, readPieceStars } from "@/lib/game/exercise-progress";
import { EXERCISES, LABYRINTHS } from "@/lib/game/exercises";
import {
  type DailyProgress,
  getDailyHistoryCount,
  getDailyProgress,
  isCompletedToday,
  todayUtc,
} from "@/lib/daily/progress";
import { badgesAbi } from "@/lib/contracts/badges";
import { getBadgesAddress } from "@/lib/contracts/chains";
import type { PieceId } from "@/lib/game/types";
import { useProSheetState } from "@/lib/pro/use-pro-sheet-state";
import { daysRemaining } from "@/lib/pro/days-remaining";
import { subscribeToShieldChanges } from "@/lib/shop/shield-events";
import { subscribeToDailyProgressChanges } from "@/lib/daily/events";
import { readDisplayedShields } from "@/lib/shop/shield-storage";
import { useShieldSync } from "@/lib/shop/use-shield-sync";
import { track } from "@/lib/telemetry";
import {
  REWARD_TILE_ORDER,
  deriveRewardTiles,
} from "@/lib/hub/derive-reward-tiles";
import { CHESSCITO_LITE_MODE } from "@/lib/feature-flags";
import { pieceProgressStorageKey } from "@/lib/lite-progress-storage";

/** On-chain badge IDs in slot order — matches `exercises-screen.tsx`'s
 *  `BADGE_LEVEL_IDS` enumeration. Index 0 = id 1 = rook, index 1 = id 2
 *  = bishop, etc. Distinct from `REWARD_TILE_ORDER` (the *narrative*
 *  unlock order surfaced in the column). */
const BADGE_PIECE_BY_INDEX: readonly PieceId[] = [
  "rook",
  "bishop",
  "knight",
  "pawn",
  "queen",
  "king",
] as const;

const BADGE_LEVEL_IDS = [1n, 2n, 3n, 4n, 5n, 6n] as const;

export type HubInitialSheet =
  | "shop"
  | "pro"
  | "badges"
  | "trophies"
  | "profile"
  | "settings";

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

function loadShieldCount(): number {
  return readDisplayedShields();
}

function loadStarsPerPiece(): Partial<Record<PieceId, number>> {
  if (typeof window === "undefined") {
    return {};
  }

  const stars: Partial<Record<PieceId, number>> = {};
  for (const piece of REWARD_TILE_ORDER) {
    try {
      const raw = window.localStorage.getItem(pieceProgressStorageKey(piece));
      if (!raw) continue;
      const parsed = JSON.parse(raw) as { stars?: unknown };
      // Tolerate both the legacy positional `stars: number[]` and the
      // id-keyed `stars: Record<id, number>` shape (post-2026-06-16
      // migration). Sum the in-range values either way.
      const values = Array.isArray(parsed.stars)
        ? parsed.stars
        : parsed.stars && typeof parsed.stars === "object"
          ? Object.values(parsed.stars)
          : null;
      if (values) {
        const total = values.reduce<number>((acc, s) => {
          if (typeof s === "number" && Number.isFinite(s) && s >= 0 && s <= 3) {
            return acc + s;
          }
          return acc;
        }, 0);
        stars[piece] = total;
      }
    } catch {
      // ignore corrupt entries; fall through to 0 (no progress).
    }
  }

  return stars;
}

type ProShape =
  | { active: true; daysRemaining: number }
  | { active: false };

function deriveProShape(
  status: { active: boolean; expiresAt: number | null } | null,
  now: number,
): ProShape {
  if (!status?.active) return { active: false };
  const days = daysRemaining(status.expiresAt, now);
  if (days == null) return { active: false };
  return { active: true, daysRemaining: days };
}

/** Client-side container that hydrates `<HubScaffold>` with real data:
 *  - Trophies: count of claimed badges (Badges contract, batched read).
 *  - PRO chip: `useProStatus(address)` shape + days-remaining math.
 *  - Reward tiles: `deriveRewardTiles({ badgesClaimed, starsPerPiece })`.
 *  - Tap handlers: routed to existing destinations (`/trophies` for the
 *    trophy chip, `/hub` legacy for the rest) until the flag flip in
 *    Story 1.12 final replaces them with in-scaffold sheets.
 *
 *  Pure presentational composition — no on-chain mutations belong here.
 *  Those stay on `<ExercisesScreen>` until the scaffold becomes the default. */
export function HubScaffoldClient({
  initialSheet,
}: {
  initialSheet?: HubInitialSheet;
}) {
  const tHud = useTranslations("HUD_COPY");
  const tScaffold = useTranslations("HUB_SCAFFOLD_COPY");
  const tSettings = useTranslations("SETTINGS_STUB_COPY");
  const router = useRouter();
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const badgesAddress = useMemo(() => getBadgesAddress(chainId), [chainId]);
  // Direct injected connect (RainbowKit removed, P2 2026-06-12). In
  // MiniPay the auto-connect in <WalletProvider> wins before this CTA
  // ever renders; on desktop it triggers the extension prompt.
  const { connectWallet } = useConnectWallet();

  // PRO sheet orchestration. Owns its own status fetch internally so
  // we don't double-fetch /api/pro/status from this surface.
  const proSheet = useProSheetState();
  const proStatus = proSheet.proStatus;

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
  const shopSheet = useShopSheetState();
  const openBadgeSheet = badgeSheet.openSheet;
  const openProSheet = proSheet.openSheet;
  const openShopSheet = shopSheet.openSheet;
  const initialSheetOpenedRef = useRef(false);
  const proTrainingCardViewedRef = useRef(false);

  // SPEC 1 D9/D10 wiring — Profile sheet, Settings stub.
  // Lite Mode: deep-link ?sheet=profile must not open ProfileSheet (it mounts ProSheet).
  const [profileOpen, setProfileOpen] = useState(!CHESSCITO_LITE_MODE && initialSheet === "profile");
  const [settingsOpen, setSettingsOpen] = useState(initialSheet === "settings");
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

  const { data: badgesData } = useReadContracts({
    contracts: BADGE_LEVEL_IDS.map((lid) => ({
      address: badgesAddress ?? undefined,
      abi: badgesAbi,
      functionName: "hasClaimedBadge" as const,
      args: address ? ([address, lid] as const) : undefined,
      chainId,
    })),
    query: {
      enabled: Boolean(address && badgesAddress),
      staleTime: 2 * 60_000,
    },
  });

  const badgesClaimed = useMemo<Partial<Record<PieceId, boolean>>>(() => {
    const map: Partial<Record<PieceId, boolean>> = {};
    BADGE_PIECE_BY_INDEX.forEach((piece, idx) => {
      const result = badgesData?.[idx]?.result;
      if (typeof result === "boolean") {
        map[piece] = result;
      }
    });
    return map;
  }, [badgesData]);

  // localStorage is browser-only — defer to mount to keep SSR + first
  // paint identical (no hydration mismatch).
  const [starsPerPiece, setStarsPerPiece] = useState<Partial<Record<PieceId, number>>>({});
  const [shieldCount, setShieldCount] = useState<number>(0);
  useEffect(() => {
    setStarsPerPiece(loadStarsPerPiece());
    setShieldCount(loadShieldCount());
  }, []);

  // Re-read shields from localStorage every time the shop hook bumps the
  // count after `buyItem` confirms. Native `storage` events only fire
  // cross-tab, so we use an in-tab CustomEvent bus. Without this the
  // chip stayed stuck at the pre-purchase value until full reload — the
  // exact P0-2 from the 2026-05-08 red team.
  useEffect(() => {
    return subscribeToShieldChanges(() => {
      setShieldCount(loadShieldCount());
    });
  }, []);

  const trophies = useMemo(
    () => Object.values(badgesClaimed).filter((v) => v === true).length,
    [badgesClaimed],
  );

  const pro = useMemo(() => deriveProShape(proStatus, Date.now()), [proStatus]);

  // Hero CTA signals are read from localStorage, so defer the read to
  // client-mount to avoid SSR/CSR hydration mismatch. While null, the
  // hero falls back to the safe default ("CONTINUE TRAINING" amber).
  const [heroSignals, setHeroSignals] = useState<
    Omit<HeroContextState, "isLoading"> | null
  >(null);
  useEffect(() => {
    setHeroSignals({
      exercisesCompletedCount: getExercisesCompletedCount(),
      dailyHistoryCount: getDailyHistoryCount(),
      isDailyCompletedToday: isCompletedToday(),
    });
  }, []);
  const hero = useMemo(
    () =>
      getHeroContextAction({
        isLoading: heroSignals === null,
        exercisesCompletedCount: heroSignals?.exercisesCompletedCount ?? 0,
        dailyHistoryCount: heroSignals?.dailyHistoryCount ?? 0,
        isDailyCompletedToday: heroSignals?.isDailyCompletedToday ?? false,
      }),
    [heroSignals],
  );

  // Focus Passport (Lite-only, P1). Defer the localStorage read to
  // client-mount (same anti-hydration pattern as heroSignals): `null`
  // means "loading", so the card paints its safe empty shell on the
  // server + first client render and never shows false filled days.
  const [dailyProgress, setDailyProgress] = useState<DailyProgress | null>(null);
  useEffect(() => {
    if (!CHESSCITO_LITE_MODE) return;
    setDailyProgress(getDailyProgress());
  }, []);
  // Re-read daily progress when HubDailyTile (or DailyTacticSlot) records
  // a completion in the same tab. The native `storage` event only fires
  // cross-tab; this in-tab bus covers the same-tab path so Focus Passport
  // and Content Loop update immediately without requiring navigation.
  useEffect(() => {
    if (!CHESSCITO_LITE_MODE) return;
    return subscribeToDailyProgressChanges(() => {
      setDailyProgress(getDailyProgress());
    });
  }, []);
  const focusPassport = useMemo(
    () =>
      CHESSCITO_LITE_MODE
        ? {
            streak: dailyProgress?.streak ?? 0,
            totalCompleted: dailyProgress?.totalCompleted ?? 0,
            todayDone: dailyProgress
              ? dailyProgress.lastCompletedDate === todayUtc()
              : false,
            isLoading: dailyProgress === null,
          }
        : null,
    [dailyProgress],
  );

  // Content Loop v1 (Lite-only). Derives the Next Best Action from existing
  // localStorage data: DailyProgress (already hydrated above via dailyProgress
  // state), WelcomePackage, and the primary piece training path.
  // isContentLoopHydrated gates rendering to prevent flash of wrong variant.
  const welcomePackage = useWelcomePackage();
  const [contentLoopAction, setContentLoopAction] = useState<ContentLoopAction | null>(null);
  const [isContentLoopHydrated, setIsContentLoopHydrated] = useState(false);
  useEffect(() => {
    if (!CHESSCITO_LITE_MODE) return;
    // Wait for dailyProgress to be hydrated first (see focusPassport state above).
    if (dailyProgress === null) return;

    const piece = LITE_PRIMARY_PIECE;
    const stars = readPieceStars(piece);
    const progress = { piece, currentId: null as string | null, stars };
    const labyrinthBests = getLabyrinthBestsMap(piece);
    const primaryPath = buildTrainingPath({
      piece,
      progress,
      labyrinthBests,
      badgeClaimed: false,
      catalog: { exercises: EXERCISES, labyrinths: LABYRINTHS },
    });

    const action = deriveContentLoopAction({
      daily: dailyProgress,
      today: todayUtc(),
      welcomePackage: {
        unlocked: welcomePackage.isUnlocked,
        claimed: welcomePackage.isClaimed,
      },
      primaryPiece: piece,
      primaryPath,
      nextAvailablePiece: null,
    });

    setContentLoopAction(action);
    setIsContentLoopHydrated(true);
  }, [dailyProgress, welcomePackage.isUnlocked, welcomePackage.isClaimed]);

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
    const tiles = deriveRewardTiles({ badgesClaimed, starsPerPiece });
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
  }, [badgesClaimed, starsPerPiece, router]);

  // The shields chip is the home for shop conversion (the user's primary
  // monetization surface). Always visible whether the count is 0 or N —
  // a depleted "Shield ×0" is the strongest replenishment cue.
  const shieldsValue = shieldCount;

  return (
    <>
      <HubScaffold
        trophies={trophies}
        pro={pro}
        shields={null}
        focusPassport={focusPassport}
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
        onArenaPress={CHESSCITO_LITE_MODE ? undefined : handleArenaPress}
        miniArenaUnlocked={!CHESSCITO_LITE_MODE && (starsPerPiece.rook ?? 0) >= 12}
        nextStepCard={
          CHESSCITO_LITE_MODE && contentLoopAction
            ? { action: contentLoopAction, isHydrated: isContentLoopHydrated }
            : null
        }
      />
      {!CHESSCITO_LITE_MODE && <ProSheet {...proSheet.sheetProps} />}
      {!CHESSCITO_LITE_MODE && <BadgeSheet {...badgeSheet.sheetProps} />}
      {!CHESSCITO_LITE_MODE && <ShopSheet {...shopSheet.sheetProps} />}
      {!CHESSCITO_LITE_MODE && <PurchaseConfirmSheet {...shopSheet.confirmProps} />}
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
