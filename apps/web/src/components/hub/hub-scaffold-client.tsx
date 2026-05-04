"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAccount, useChainId, useReadContracts } from "wagmi";

import { HubScaffold } from "@/components/hub/hub-scaffold";
import { badgesAbi } from "@/lib/contracts/badges";
import { getBadgesAddress } from "@/lib/contracts/chains";
import { HUD_COPY } from "@/lib/content/editorial";
import type { PieceId } from "@/lib/game/types";
import { useProStatus } from "@/lib/pro/use-pro-status";
import {
  REWARD_TILE_ORDER,
  deriveRewardTiles,
} from "@/lib/hub/derive-reward-tiles";

/** On-chain badge IDs in slot order — matches `play-hub-root.tsx`'s
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
const PLAY_LABEL = "PLAY";
const PLAY_ARIA_LABEL = "Start training";

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
 *  Those stay on `<PlayHubRoot>` until the scaffold becomes the default. */
export function HubScaffoldClient() {
  const router = useRouter();
  const { address } = useAccount();
  const chainId = useChainId();
  const badgesAddress = useMemo(() => getBadgesAddress(chainId), [chainId]);

  const { status: proStatus } = useProStatus(address);

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
  useEffect(() => {
    setStarsPerPiece(loadStarsPerPiece());
  }, []);

  const trophies = useMemo(
    () => Object.values(badgesClaimed).filter((v) => v === true).length,
    [badgesClaimed],
  );

  const pro = useMemo(() => deriveProShape(proStatus, Date.now()), [proStatus]);

  const rewardTiles = useMemo(
    () =>
      deriveRewardTiles({
        badgesClaimed,
        starsPerPiece,
        onTileTap: () => router.push("/hub"),
      }),
    [badgesClaimed, starsPerPiece, router],
  );

  return (
    <HubScaffold
      trophies={trophies}
      pro={pro}
      rewardTiles={rewardTiles}
      premiumKicker={PREMIUM_KICKER}
      premiumInactiveLabel={PREMIUM_INACTIVE_LABEL}
      premiumProgressFormat={HUD_COPY.starsFormat}
      premiumAriaLabel={premiumAriaLabel(pro, 0, 0)}
      premiumUsed={0}
      premiumTotal={0}
      playLabel={PLAY_LABEL}
      playAriaLabel={PLAY_ARIA_LABEL}
      onTrophyTap={() => router.push("/trophies")}
      onProTap={() => router.push("/hub")}
      onPremiumTap={() => router.push("/hub")}
      onPlayPress={() => router.push("/hub")}
    />
  );
}
