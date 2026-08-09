"use client";

import { useEffect, useMemo, useState } from "react";
import { useAccount, useChainId, useReadContracts } from "wagmi";

import { badgesAbi } from "@/lib/contracts/badges";
import { getBadgesAddress } from "@/lib/contracts/chains";
import type { PieceId } from "@/lib/game/types";
import {
  DIAGONAL_RUN,
  EXERCISES,
  KNIGHT_TOUR,
  LABYRINTHS,
  PROMOTION_RUN,
  QUEENS,
  SAFE_PATH,
} from "@/lib/game/exercises";
import { getExercisesCompletedCount, readPieceStars } from "@/lib/game/exercise-progress";
import { getLabyrinthBestsMap } from "@/lib/game/labyrinth-progress";
import {
  getHeroContextAction,
  type HeroContextState,
} from "@/lib/hub/hero-cta";
import {
  deriveContentLoopAction,
  selectNextAvailablePiece,
  selectPrimaryPiece,
  type ContentLoopAction,
  type PathsByPiece,
} from "@/lib/hub/content-loop";
import { PLAYABLE_PIECES } from "@/lib/game/exercises";
import { REWARD_TILE_ORDER } from "@/lib/hub/derive-reward-tiles";
import { buildTrainingPath } from "@/lib/training/path";
import {
  coverageLaneIds,
  projectSpecialTrainingLane,
  starlessLaneIds,
} from "@/lib/training/special-training-lane";
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
import type { ChallengeCardSeasonPass } from "@/components/hub/challenge-card";
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

/** Baseline signature-game pools, for the Special Training lane projection.
 *  Module-level and frozen: this hook runs outside the ContentCatalogProvider,
 *  so there is no overlay to read — the baseline IS the catalog here. */
const SIGNATURE_POOLS = {
  diagonalRun: DIAGONAL_RUN,
  knightTour: KNIGHT_TOUR,
  queens: QUEENS,
  safePath: SAFE_PATH,
  promotionRun: PROMOTION_RUN,
} as const;

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

/** Distinct exercises completed (≥1★) per piece — the badge gate reads
 *  COMPLETION, not stars (founder 2026-07-17). Same storage + shape tolerance
 *  as `loadStarsPerPiece`; counts positive entries instead of summing them. */
function loadCompletedPerPiece(): Partial<Record<PieceId, number>> {
  if (typeof window === "undefined") {
    return {};
  }

  const completed: Partial<Record<PieceId, number>> = {};
  for (const piece of REWARD_TILE_ORDER) {
    try {
      const raw = window.localStorage.getItem(pieceProgressStorageKey(piece));
      if (!raw) continue;
      const parsed = JSON.parse(raw) as { stars?: unknown };
      const values = Array.isArray(parsed.stars)
        ? parsed.stars
        : parsed.stars && typeof parsed.stars === "object"
          ? Object.values(parsed.stars)
          : null;
      if (values) {
        completed[piece] = values.filter(
          (s) => typeof s === "number" && Number.isFinite(s) && s > 0 && s <= 3,
        ).length;
      }
    } catch {
      // ignore corrupt entries; fall through to 0 (no progress).
    }
  }

  return completed;
}

/** Raw id→stars map per piece, deliberately NOT aggregated.
 *
 *  `loadCompletedPerPiece` above returns a total, and that total is the WIDE
 *  count — it sums every positive entry in storage, retired ids included,
 *  because mastery is never revoked when internal ids change. Correct for the
 *  badge gate, wrong for anything the player can count on screen.
 *
 *  The visible counter takes this map through `completedExerciseCount`, which
 *  intersects it with the live catalog — the same function the drawer uses.
 *  Paso 2: `docs/specs/2026-08-09-hub-tile-progress-counter.md`. */
function loadStarsByIdPerPiece(): Partial<
  Record<PieceId, Record<string, number>>
> {
  if (typeof window === "undefined") {
    return {};
  }

  const byPiece: Partial<Record<PieceId, Record<string, number>>> = {};
  for (const piece of REWARD_TILE_ORDER) {
    try {
      const raw = window.localStorage.getItem(pieceProgressStorageKey(piece));
      if (!raw) continue;
      const parsed = JSON.parse(raw) as { stars?: unknown };
      // Only the id-keyed object shape is usable here. A legacy array has no
      // ids to intersect with, so it contributes nothing rather than a number
      // that cannot be reconciled with the drawer.
      if (
        !parsed.stars ||
        typeof parsed.stars !== "object" ||
        Array.isArray(parsed.stars)
      ) {
        continue;
      }
      const entries = Object.entries(parsed.stars).filter(
        ([, s]) => typeof s === "number" && Number.isFinite(s) && s > 0 && s <= 3,
      ) as [string, number][];
      if (entries.length > 0) {
        byPiece[piece] = Object.fromEntries(entries);
      }
    } catch {
      // ignore corrupt entries; a missing piece simply has no counter.
    }
  }

  return byPiece;
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
  /** Last completed UTC day ("YYYY-MM-DD"), or null if never. Needed by the
   *  weekly row: `streak` alone cannot say WHEN the run happened, and a stored
   *  streak is not normalized on read, so a stale one would paint days the
   *  player never earned. Optional so probes/fixtures can omit it. */
  lastCompletedDate?: string | null;
};

export type HubSessionQuota = {
  isAtFreeLimit: boolean;
  isAtHardMax: boolean;
} | null;

export type SeasonChallengeMeta = {
  /** La meta que la tarjeta nombra: cuántos Focus Days hay que completar. */
  challengeGoalDays: number;
  /** La ventana dentro de la cual hay que lograrla. Campo aparte porque la
   *  oferta tiene que poder decir las dos cosas sin que una se disfrace de la
   *  otra — y porque ambos son `number`, así que cruzarlos compila. */
  accessDurationDays: number;
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
  /** Distinct exercises completed (≥1★) per piece — drives the badge gate.
   *  The WIDE count: retired ids included, so mastery is never revoked. */
  completedPerPiece: Partial<Record<PieceId, number>>;
  /** Raw id→stars per piece — drives the VISIBLE counter, which intersects
   *  with the live catalog so the tile agrees with the drawer. */
  starsByIdPerPiece: Partial<Record<PieceId, Record<string, number>>>;
  /** `true` once the mount effect read localStorage. Any consumer that
   *  asserts a number must wait for it. */
  isProgressHydrated: boolean;
  shieldCount: number;
  hero: ReturnType<typeof getHeroContextAction>;
};

/** Lite-only hub data. The `*Passport`/`contentLoop`/`sessionQuota` fields are
 *  null when `CHESSCITO_LITE_MODE` is off (Full never reads them). */
export type HubLiteData = {
  focusPassport: HubFocusPassport | null;
  contentLoop: {
    action: ContentLoopAction | null;
    isHydrated: boolean;
    /** The piece the loop reasoned about. Start Focus needs it to name the
     *  piece on destinations that carry none (`?slot=daily`, null). */
    primaryPiece: PieceId | null;
  };
  sessionQuota: HubSessionQuota;
  seasonPass: {
    active: boolean;
    source: "pro" | "season_pass" | null;
    loading: boolean;
    /** Needed to derive the Focus Days window (days left). */
    seasonPassExpiresAt: string | null;
    refresh: () => void | Promise<void>;
  };
  /** Discriminated slice for <ChallengeCard> (active → day + shields). */
  challengeSeasonPass: ChallengeCardSeasonPass;
  challenge: SeasonChallengeMeta;
};

export type HubData = {
  shared: HubSharedData;
  lite: HubLiteData;
};

// ─── Hook ────────────────────────────────────────────────────────────────────

/** Hydrates the legacy Learn/Full Hub from wagmi + localStorage. Play must use
 *  `usePlayHubData` so Training progress hooks and storage never execute. */
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
  const [completedPerPiece, setCompletedPerPiece] = useState<
    Partial<Record<PieceId, number>>
  >({});
  const [shieldCount, setShieldCount] = useState<number>(0);
  const [starsByIdPerPiece, setStarsByIdPerPiece] = useState<
    Partial<Record<PieceId, Record<string, number>>>
  >({});
  // Gates every consumer that asserts a NUMBER. States survived the first
  // paint reading `{}` because a state asserts nothing numeric; a counter
  // does, and "0/4" on a piece with 3 done is a visible lie.
  const [isProgressHydrated, setIsProgressHydrated] = useState(false);
  useEffect(() => {
    setStarsPerPiece(loadStarsPerPiece());
    setCompletedPerPiece(loadCompletedPerPiece());
    setStarsByIdPerPiece(loadStarsByIdPerPiece());
    setShieldCount(loadShieldCount());
    setIsProgressHydrated(true);
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
            lastCompletedDate: dailyProgress?.lastCompletedDate ?? null,
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
  const [primaryPiece, setPrimaryPiece] = useState<PieceId | null>(null);
  useEffect(() => {
    if (!CHESSCITO_LITE_MODE) return;
    if (dailyProgress === null) return;

    // Every playable piece, not just the rook. The loop used to evaluate
    // `LITE_PRIMARY_PIECE` forever and pass `nextAvailablePiece: null` — a
    // Lite-v1 hardcode from when the rook was the only piece. It made the
    // `next-piece` variant unreachable, so a player who had finished the rook
    // was told to keep training it, and Start Focus dropped them back onto its
    // last exercise on every entry.
    // The lane the player actually sees, not the raw labyrinths. Passing
    // LABYRINTHS here made the hub reason about `queen-lab-*` nodes the
    // exercises screen had already replaced with `queens-*`, so Start Focus
    // recommended levels that no longer exist in the lane. Same projection
    // both sides — from the baseline pools, since this hook reads outside the
    // ContentCatalogProvider (no overlay in Lite).
    const specialTrainingLane = projectSpecialTrainingLane(LABYRINTHS, SIGNATURE_POOLS);
    const paths: PathsByPiece = {};
    for (const candidate of PLAYABLE_PIECES) {
      paths[candidate] = buildTrainingPath({
        piece: candidate,
        progress: {
          piece: candidate,
          currentId: null as string | null,
          stars: readPieceStars(candidate),
        },
        labyrinthBests: getLabyrinthBestsMap(candidate),
        badgeClaimed: false,
        catalog: { exercises: EXERCISES, labyrinths: specialTrainingLane },
        coverageIds: coverageLaneIds(SIGNATURE_POOLS, candidate),
        starlessIds: starlessLaneIds(SIGNATURE_POOLS, candidate),
      });
    }

    const piece = selectPrimaryPiece(PLAYABLE_PIECES, paths);
    const primaryPath = paths[piece] ?? [];

    const action = deriveContentLoopAction({
      daily: dailyProgress,
      today: todayUtc(),
      welcomePackage: {
        unlocked: welcomePackage.isUnlocked,
        claimed: welcomePackage.isClaimed,
      },
      primaryPiece: piece,
      primaryPath,
      nextAvailablePiece: selectNextAvailablePiece(PLAYABLE_PIECES, paths, piece),
      sessionQuota: sessionQuotaState,
    });

    setContentLoopAction(action);
    setPrimaryPiece(piece as PieceId);
    setIsContentLoopHydrated(true);
  }, [dailyProgress, welcomePackage.isUnlocked, welcomePackage.isClaimed, sessionQuotaState]);

  // Season pass status + challenge meta (single config source).
  const seasonPassStatus = useSeasonPassStatus(address);
  const challenge = useMemo<SeasonChallengeMeta>(() => {
    const pass = getSeasonPass("lite_season_pass_21");
    return {
      challengeGoalDays: pass.challengeGoalDays,
      accessDurationDays: pass.accessDurationDays,
      shieldBonus: pass.shieldsOnPurchase,
      priceLabel: formatUsd6(pass.priceUsd6),
    };
  }, []);

  // Discriminated season-pass slice for <ChallengeCard>. Active → carry the
  // credited shields. Offer → just the loading flag (gates the buy CTA against
  // FOUC).
  //
  // The old `dayOfChallenge` is gone: progress is what the Focus Days ledger
  // recorded, not a wall-clock ordinal derived from the pass expiry. Deriving
  // it here made "Day N of 21" advance while the player skipped days.
  const challengeSeasonPass = useMemo<ChallengeCardSeasonPass>(() => {
    if (seasonPassStatus.active) {
      if (seasonPassStatus.source === "pro") {
        return { active: true, source: "pro" };
      }
      if (!seasonPassStatus.seasonPassExpiresAt) {
        return { active: false, isLoading: false };
      }
      return {
        active: true,
        source: "season_pass",
        shieldsCredited: seasonPassStatus.shieldsCredited ?? challenge.shieldBonus,
      };
    }
    return { active: false, isLoading: seasonPassStatus.loading };
  }, [seasonPassStatus, challenge.shieldBonus]);

  return {
    shared: {
      address,
      isConnected,
      trophies,
      badgesClaimed,
      starsPerPiece,
      completedPerPiece,
      starsByIdPerPiece,
      isProgressHydrated,
      shieldCount,
      hero,
    },
    lite: {
      focusPassport,
      contentLoop: {
        action: contentLoopAction,
        isHydrated: isContentLoopHydrated,
        primaryPiece,
      },
      sessionQuota: sessionQuotaState,
      seasonPass: {
        active: seasonPassStatus.active,
        source: seasonPassStatus.source,
        loading: seasonPassStatus.loading,
        seasonPassExpiresAt: seasonPassStatus.seasonPassExpiresAt,
        refresh: seasonPassStatus.refresh,
      },
      challengeSeasonPass,
      challenge,
    },
  };
}
