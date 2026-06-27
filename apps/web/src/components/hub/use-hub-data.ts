"use client";

import { useEffect, useMemo, useState } from "react";
import { useAccount, useChainId, useReadContracts } from "wagmi";

import { badgesAbi } from "@/lib/contracts/badges";
import { getBadgesAddress } from "@/lib/contracts/chains";
import type { PieceId } from "@/lib/game/types";
import { EXERCISES, LABYRINTHS } from "@/lib/game/exercises";
import { getExercisesCompletedCount, readPieceStars } from "@/lib/game/exercise-progress";
import { getLabyrinthBestsMap } from "@/lib/game/labyrinth-progress";
import {
  getHeroContextAction,
  type HeroContextState,
} from "@/lib/hub/hero-cta";
import {
  deriveContentLoopAction,
  LITE_PRIMARY_PIECE,
  type ContentLoopAction,
} from "@/lib/hub/content-loop";
import { REWARD_TILE_ORDER } from "@/lib/hub/derive-reward-tiles";
import { buildTrainingPath } from "@/lib/training/path";
import {
  type DailyProgress,
  getDailyHistoryCount,
  getDailyProgress,
  isCompletedToday,
  todayUtc,
} from "@/lib/daily/progress";
import { subscribeToDailyProgressChanges } from "@/lib/daily/events";
import {
  getDailySession,
  isAtFreeLimit,
  isAtHardMax,
} from "@/lib/daily/session-quota";
import { subscribeToDailySessionChanges } from "@/lib/daily/session-events";
import { readDisplayedShields } from "@/lib/shop/shield-storage";
import { subscribeToShieldChanges } from "@/lib/shop/shield-events";
import { pieceProgressStorageKey } from "@/lib/lite-progress-storage";
import { getSeasonPass } from "@/lib/payments/rail-config";
import { useSeasonPassStatus } from "@/lib/season-pass/use-season-pass-status";
import { useWelcomePackage } from "@/lib/welcome-package/use-welcome-package";
import { CHESSCITO_LITE_MODE } from "@/lib/feature-flags";

// ─── Constants (moved verbatim from hub-scaffold-client) ─────────────────────

/** On-chain badge IDs in slot order — matches `exercises-screen.tsx`'s
 *  `BADGE_LEVEL_IDS` enumeration. Index 0 = id 1 = rook, etc. Distinct from
 *  `REWARD_TILE_ORDER` (the narrative unlock order in the column). */
const BADGE_PIECE_BY_INDEX: readonly PieceId[] = [
  "rook",
  "bishop",
  "knight",
  "pawn",
  "queen",
  "king",
] as const;

const BADGE_LEVEL_IDS = [1n, 2n, 3n, 4n, 5n, 6n] as const;

// ─── localStorage loaders (moved verbatim) ───────────────────────────────────

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

function formatUsd6(value: bigint): string {
  return `$${(Number(value) / 1_000_000).toFixed(2)}`;
}

// ─── Contracts (SDD) ─────────────────────────────────────────────────────────

export type HubFocusPassport = {
  streak: number;
  totalCompleted: number;
  todayDone: boolean;
  isLoading: boolean;
};

export type HubSessionQuota = {
  isAtFreeLimit: boolean;
  isAtHardMax: boolean;
} | null;

export type SeasonChallengeMeta = {
  durationDays: number;
  shieldBonus: number;
  priceLabel: string;
};

/** Mode-agnostic hub data, consumed by both the Full and Lite presenters. */
export type HubSharedData = {
  address: `0x${string}` | undefined;
  isConnected: boolean;
  trophies: number;
  badgesClaimed: Partial<Record<PieceId, boolean>>;
  starsPerPiece: Partial<Record<PieceId, number>>;
  shieldCount: number;
  hero: ReturnType<typeof getHeroContextAction>;
};

/** Lite-only hub data. The `*Passport`/`contentLoop`/`sessionQuota` fields are
 *  null when `CHESSCITO_LITE_MODE` is off (Full never reads them). */
export type HubLiteData = {
  focusPassport: HubFocusPassport | null;
  contentLoop: { action: ContentLoopAction | null; isHydrated: boolean };
  sessionQuota: HubSessionQuota;
  seasonPass: { active: boolean; loading: boolean; refresh: () => void | Promise<void> };
  challenge: SeasonChallengeMeta;
};

export type HubData = {
  shared: HubSharedData;
  lite: HubLiteData;
};

// ─── Hook ────────────────────────────────────────────────────────────────────

/** Hydrates all `/hub` data from wagmi + localStorage. Pure data only — no
 *  sheet orchestration, handlers, or JSX (those stay in the presenters). */
export function useHubData(): HubData {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const badgesAddress = useMemo(() => getBadgesAddress(chainId), [chainId]);

  // Trophies — count of claimed badges (batched on-chain read).
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

  const trophies = useMemo(
    () => Object.values(badgesClaimed).filter((v) => v === true).length,
    [badgesClaimed],
  );

  // localStorage is browser-only — defer to mount to keep SSR + first paint
  // identical (no hydration mismatch).
  const [starsPerPiece, setStarsPerPiece] = useState<Partial<Record<PieceId, number>>>({});
  const [shieldCount, setShieldCount] = useState<number>(0);
  useEffect(() => {
    setStarsPerPiece(loadStarsPerPiece());
    setShieldCount(loadShieldCount());
  }, []);

  // Re-read shields on the in-tab CustomEvent bus after `buyItem` confirms.
  useEffect(() => {
    return subscribeToShieldChanges(() => {
      setShieldCount(loadShieldCount());
    });
  }, []);

  // Hero CTA signals (localStorage) — deferred to mount; null → safe default.
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

  // Focus Passport (Lite-only). Deferred read; null = loading.
  const [dailyProgress, setDailyProgress] = useState<DailyProgress | null>(null);
  useEffect(() => {
    if (!CHESSCITO_LITE_MODE) return;
    setDailyProgress(getDailyProgress());
  }, []);
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

  // Daily session quota (Lite-only). Hydrated on mount, re-read on same-tab
  // session events and on tab focus.
  const [sessionQuotaState, setSessionQuotaState] = useState<HubSessionQuota>(null);
  useEffect(() => {
    if (!CHESSCITO_LITE_MODE) return;
    const read = () => {
      const s = getDailySession();
      setSessionQuotaState({ isAtFreeLimit: isAtFreeLimit(s), isAtHardMax: isAtHardMax(s) });
    };
    read();
    const unsub = subscribeToDailySessionChanges(read);
    const onVisibility = () => {
      if (document.visibilityState === "visible") read();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      unsub();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  // Content Loop v1 (Lite-only). Derives the Next Best Action from existing
  // localStorage data. `isHydrated` gates rendering to prevent variant flash.
  const welcomePackage = useWelcomePackage();
  const [contentLoopAction, setContentLoopAction] = useState<ContentLoopAction | null>(null);
  const [isContentLoopHydrated, setIsContentLoopHydrated] = useState(false);
  useEffect(() => {
    if (!CHESSCITO_LITE_MODE) return;
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
      sessionQuota: sessionQuotaState,
    });

    setContentLoopAction(action);
    setIsContentLoopHydrated(true);
  }, [dailyProgress, welcomePackage.isUnlocked, welcomePackage.isClaimed, sessionQuotaState]);

  // Season pass status + challenge meta (single config source).
  const seasonPassStatus = useSeasonPassStatus(address);
  const challenge = useMemo<SeasonChallengeMeta>(() => {
    const pass = getSeasonPass("lite_season_pass_21");
    return {
      durationDays: pass.durationDays,
      shieldBonus: pass.shieldsOnPurchase,
      priceLabel: formatUsd6(pass.priceUsd6),
    };
  }, []);

  return {
    shared: {
      address,
      isConnected,
      trophies,
      badgesClaimed,
      starsPerPiece,
      shieldCount,
      hero,
    },
    lite: {
      focusPassport,
      contentLoop: { action: contentLoopAction, isHydrated: isContentLoopHydrated },
      sessionQuota: sessionQuotaState,
      seasonPass: {
        active: seasonPassStatus.active,
        loading: seasonPassStatus.loading,
        refresh: seasonPassStatus.refresh,
      },
      challenge,
    },
  };
}
