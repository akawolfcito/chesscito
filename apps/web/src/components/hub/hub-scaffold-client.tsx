"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAccount, useChainId, useReadContracts } from "wagmi";
import { useConnectModal } from "@rainbow-me/rainbowkit";

import { HubScaffold } from "@/components/hub/hub-scaffold";
import { badgesAbi } from "@/lib/contracts/badges";
import { getBadgesAddress } from "@/lib/contracts/chains";
import { HUD_COPY } from "@/lib/content/editorial";
import { EXERCISES } from "@/lib/game/exercises";
import type { PieceId } from "@/lib/game/types";
import { useProStatus } from "@/lib/pro/use-pro-status";
import { track } from "@/lib/telemetry";
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
const SHIELDS_STORAGE_KEY = "chesscito:shields";
const MS_PER_DAY = 86_400_000;

/** Routes for transition-period delegations to the legacy hub. The
 *  scaffold owns the menu surface; the heavy on-chain mutation flows
 *  (claim badge, mint, shop purchase, PRO sheet) still live on
 *  `<PlayHubRoot>`. PlayHubRoot reads `?action` + `?piece` from the URL
 *  and seeds its initial state. */
const LEGACY_HUB = "/hub?legacy=1";
function legacyHubFor(
  action: "shop" | "pro" | "badges" | "trophies",
  piece?: PieceId,
) {
  // Defensive — only attach the piece query when the piece has at least
  // one shippable exercise. Pieces without exercises (queen/king today)
  // would crash the legacy board if it tried to read EXERCISES[piece][0].
  // The page.tsx validator filters again at the boundary, but dropping
  // the query here makes the scaffold side correct on its own.
  const includePiece =
    piece !== undefined &&
    Array.isArray((EXERCISES as Record<string, unknown[] | undefined>)[piece]) &&
    ((EXERCISES as Record<string, unknown[] | undefined>)[piece]?.length ?? 0) > 0;
  const pieceQuery = includePiece ? `&piece=${piece}` : "";
  return `${LEGACY_HUB}&action=${action}${pieceQuery}`;
}

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

function loadShieldCount(): number {
  if (typeof window === "undefined") {
    return 0;
  }
  try {
    const raw = window.localStorage.getItem(SHIELDS_STORAGE_KEY);
    if (!raw) return 0;
    const n = Number.parseInt(raw, 10);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  } catch {
    return 0;
  }
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
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const badgesAddress = useMemo(() => getBadgesAddress(chainId), [chainId]);
  // RainbowKit's connect modal — `openConnectModal` is undefined until
  // the provider mounts (RainbowKitProvider is dynamically imported in
  // `<WalletProvider>`). Optional-chained call covers that race.
  const { openConnectModal } = useConnectModal();

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
  const [shieldCount, setShieldCount] = useState<number>(0);
  useEffect(() => {
    setStarsPerPiece(loadStarsPerPiece());
    setShieldCount(loadShieldCount());
  }, []);

  const trophies = useMemo(
    () => Object.values(badgesClaimed).filter((v) => v === true).length,
    [badgesClaimed],
  );

  const pro = useMemo(() => deriveProShape(proStatus, Date.now()), [proStatus]);

  // Single page-view event per mount — anchors the funnel for every
  // tap event below. Empty deps so we never double-fire on re-render.
  // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional once-per-mount
  useEffect(() => {
    track("hub_view");
  }, []);

  const rewardTiles = useMemo(() => {
    const tiles = deriveRewardTiles({ badgesClaimed, starsPerPiece });
    return tiles.map((tile) => ({
      ...tile,
      onTap: () => {
        track("hub_reward_tile_tap", { piece: tile.id, state: tile.state });
        // `RewardTile.id` is a union including "victory" for forward-compat
        // (REWARD_COPY exposes it), but `deriveRewardTiles` only emits
        // PieceId rows today — narrowed here so `legacyHubFor` keeps its
        // tighter `PieceId` signature.
        router.push(legacyHubFor("badges", tile.id as PieceId));
      },
    }));
  }, [badgesClaimed, starsPerPiece, router]);

  // The shields chip is the home for shop conversion (the user's primary
  // monetization surface). Always visible whether the count is 0 or N —
  // a depleted "Shield ×0" is the strongest replenishment cue.
  const shieldsValue = shieldCount;

  return (
    <HubScaffold
      trophies={trophies}
      pro={pro}
      shields={shieldsValue}
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
        router.push(legacyHubFor("trophies"));
      }}
      onProTap={() => {
        track("hub_pro_chip_tap", { pro_active: pro.active });
        router.push(legacyHubFor("pro"));
      }}
      onPremiumTap={() => {
        track("hub_premium_slot_tap", { pro_active: pro.active });
        router.push(legacyHubFor("pro"));
      }}
      onShieldsTap={() => {
        // KEY conversion event: validates the monetization-as-default
        // hypothesis behind the scaffold redesign. Shield count carried
        // as a dim so we can correlate tap rate with depletion state.
        track("hub_shields_chip_tap", { shield_count: shieldCount });
        router.push(legacyHubFor("shop"));
      }}
      onPlayPress={() => {
        track("hub_play_tap");
        // Direct route to /arena (which now defaults to the scaffold
        // selector via `af160bb`). Previously this pushed to the legacy
        // hub which forced the user to tap a second control before
        // reaching Arena — the round-trip is what the smoke test
        // perceived as "Play button broken".
        router.push("/arena");
      }}
    />
  );
}
