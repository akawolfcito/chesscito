"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAccount, useChainId, useReadContracts } from "wagmi";
import { useConnectModal } from "@rainbow-me/rainbowkit";

import { HubScaffold } from "@/components/hub/hub-scaffold";
import { BadgeSheet } from "@/components/exercises/badge-sheet";
import { PurchaseConfirmSheet } from "@/components/exercises/purchase-confirm-sheet";
import { ShopSheet } from "@/components/exercises/shop-sheet";
import { ProSheet } from "@/components/pro/pro-sheet";
import { ProfileSheet } from "@/components/profile/profile-sheet";
import { SettingsSheetStub } from "@/components/hub/settings-sheet-stub";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { ContextualHeader } from "@/components/ui/contextual-header";
import { SETTINGS_STUB_COPY } from "@/lib/content/editorial";
import { useBadgeSheetState } from "@/lib/badges/use-badge-sheet-state";
import { useShopSheetState } from "@/lib/shop/use-shop-sheet-state";
import { useClaimQueue } from "@/hooks/use-claim-queue";
import {
  getHeroContextAction,
  type HeroContextState,
} from "@/lib/hub/hero-cta";
import { getExercisesCompletedCount } from "@/lib/game/exercise-progress";
import { getDailyHistoryCount, isCompletedToday } from "@/lib/daily/progress";
import { badgesAbi } from "@/lib/contracts/badges";
import { getBadgesAddress } from "@/lib/contracts/chains";
import { HUD_COPY } from "@/lib/content/editorial";
import type { PieceId } from "@/lib/game/types";
import { useProSheetState } from "@/lib/pro/use-pro-sheet-state";
import { subscribeToShieldChanges } from "@/lib/shop/shield-events";
import { readDisplayedShields } from "@/lib/shop/shield-storage";
import { useShieldSync } from "@/lib/shop/use-shield-sync";
import { track } from "@/lib/telemetry";
import {
  REWARD_TILE_ORDER,
  deriveRewardTiles,
} from "@/lib/hub/derive-reward-tiles";

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

const PROGRESS_STORAGE_PREFIX = "chesscito:progress:";
const MS_PER_DAY = 86_400_000;

const PREMIUM_KICKER = "Training Pass";
const PREMIUM_INACTIVE_LABEL = "Go PRO";
const PLAY_LABEL = "ENTER ARENA";
const PLAY_ARIA_LABEL = "Enter the Arena";

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
) {
  if (!pro.active) {
    return "Training Pass — tap to unlock";
  }
  return `Training Pass — ${used} of ${total} sessions used, ${pro.daysRemaining} days remaining`;
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
      const raw = window.localStorage.getItem(`${PROGRESS_STORAGE_PREFIX}${piece}`);
      if (!raw) continue;
      const parsed = JSON.parse(raw) as { stars?: unknown };
      if (Array.isArray(parsed.stars)) {
        const total = parsed.stars.reduce<number>((acc, s) => {
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
  if (!status?.active || !status.expiresAt || status.expiresAt <= now) {
    return { active: false };
  }
  const daysRemaining = Math.max(
    0,
    Math.ceil((status.expiresAt - now) / MS_PER_DAY),
  );
  return { active: true, daysRemaining };
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
  const router = useRouter();
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const badgesAddress = useMemo(() => getBadgesAddress(chainId), [chainId]);
  // RainbowKit's connect modal — `openConnectModal` is undefined until
  // the provider mounts (RainbowKitProvider is dynamically imported in
  // `<WalletProvider>`). Optional-chained call covers that race.
  const { openConnectModal } = useConnectModal();

  // PRO sheet orchestration. Owns its own status fetch internally so
  // we don't double-fetch /api/pro/status from this surface.
  const proSheet = useProSheetState();
  const proStatus = proSheet.proStatus;

  // BadgeSheet orchestration — claim flow + on-chain reads. Reward tile
  // taps open this sheet in-place (port 2026-05-07) instead of bouncing
  // through `?legacy=1&action=badges`. Solves audit B7 by giving every
  // piece tap a real destination (the sheet itself) rather than the
  // collapsed legacy view that dropped the piece query for queen/king.
  const badgeSheet = useBadgeSheetState({
    onNavigateToTrophies: () => router.push("/trophies"),
  });

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
  const [profileOpen, setProfileOpen] = useState(initialSheet === "profile");
  const [settingsOpen, setSettingsOpen] = useState(initialSheet === "settings");
  // `useClaimQueue` reads pending claims out of localStorage on mount;
  // the unread count drives the avatar notif-dot once the HUD slot
  // exists (deferred — see project note).
  useClaimQueue(address);

  useEffect(() => {
    if (!initialSheet || initialSheetOpenedRef.current) return;
    initialSheetOpenedRef.current = true;
    if (initialSheet === "shop") {
      openShopSheet();
    } else if (initialSheet === "pro") {
      openProSheet();
    } else if (initialSheet === "badges") {
      openBadgeSheet();
    } else if (initialSheet === "trophies") {
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

  const handleArenaPress = useCallback(() => {
    track("secondary_arena_clicked");
    router.push("/arena");
  }, [router]);

  // Single page-view event per mount — anchors the funnel for every
  // tap event below. Empty deps so we never double-fire on re-render.
  // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional once-per-mount
  useEffect(() => {
    track("hub_view");
  }, []);

  useEffect(() => {
    if (proTrainingCardViewedRef.current) return;
    if (isConnected && proStatus === null) return;
    proTrainingCardViewedRef.current = true;
    track("pro_training_card_viewed", {
      surface: "hub",
      pro_active: pro.active,
      wallet_connected: isConnected,
      cta: pro.active ? "training_journal" : "open_pro_sheet",
    });
  }, [isConnected, pro.active, proStatus]);

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
        isWalletConnected={isConnected}
        onConnectTap={() => {
          track("hub_connect_chip_tap");
          openConnectModal?.();
        }}
        rewardTiles={rewardTiles}
        premiumKicker={PREMIUM_KICKER}
        premiumInactiveLabel={PREMIUM_INACTIVE_LABEL}
        premiumProgressFormat={HUD_COPY.starsFormat}
        premiumAriaLabel={premiumAriaLabel(pro, 0, 0)}
        premiumUsed={0}
        premiumTotal={0}
        playLabel={PLAY_LABEL}
        playAriaLabel={PLAY_ARIA_LABEL}
        onTrophyTap={() => {
          track("hub_trophy_tap", { count: trophies });
          // Direct route to /trophies instead of legacy round-trip.
          // Same TrophiesBody renders, no bounce loop, deep-linkable.
          router.push("/trophies");
        }}
        onProTap={() => {
          track("hub_pro_chip_tap", { pro_active: pro.active });
          // In-place ProSheet (port 2026-05-07). Kills the legacy
          // ?legacy=1&action=pro round-trip + the B2 nav race that
          // bounce caused; sheet renders directly above the scaffold.
          proSheet.openSheet();
        }}
        onCoachTap={() => {
          track("hub_coach_chip_tap", { pro_active: pro.active });
          if (pro.active) {
            router.push("/coach/history");
          } else {
            proSheet.openSheet();
          }
        }}
        onPremiumTap={() => {
          track("hub_premium_slot_tap", { pro_active: pro.active });
          proSheet.openSheet();
        }}
        onShieldsTap={() => {
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
          label: HUD_COPY.practiceLinkLabel,
          ariaLabel: HUD_COPY.practiceLinkAriaLabel,
          onPress: () => {
            track("hub_practice_link_tap");
            router.push("/exercises");
          },
        }}
        onArenaPress={handleArenaPress}
        miniArenaUnlocked={(starsPerPiece.rook ?? 0) >= 12}
      />
      <ProSheet {...proSheet.sheetProps} />
      <BadgeSheet {...badgeSheet.sheetProps} />
      <ShopSheet {...shopSheet.sheetProps} />
      <PurchaseConfirmSheet {...shopSheet.confirmProps} />
      <ProfileSheet open={profileOpen} onOpenChange={setProfileOpen} />
      <Sheet open={settingsOpen} onOpenChange={setSettingsOpen}>
        <SheetContent
          side="bottom"
          hideClose
          title={SETTINGS_STUB_COPY.title}
          className="settings-sheet"
        >
          <div className="-mx-6 -mt-6 border-b border-[rgba(110,65,15,0.30)] pt-[calc(env(safe-area-inset-top)+0.25rem)]">
            <ContextualHeader
              variant="close-control"
              title={SETTINGS_STUB_COPY.title}
              close={{ onClick: () => setSettingsOpen(false), label: "Close settings" }}
            />
          </div>
          <SettingsSheetStub buildSha={process.env.NEXT_PUBLIC_BUILD_SHA ?? "dev"} />
        </SheetContent>
      </Sheet>
    </>
  );
}
