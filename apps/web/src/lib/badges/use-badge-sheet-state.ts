"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  useAccount,
  useChainId,
  useReadContracts,
  useWriteContract,
} from "wagmi";

import { badgesAbi } from "@/lib/contracts/badges";
import {
  getBadgesAddress,
  getConfiguredChainId,
  getMiniPayFeeCurrency,
} from "@/lib/contracts/chains";
import { getLevelId } from "@/lib/contracts/scoreboard";
import { hapticSuccess } from "@/lib/haptics";
import { isUserCancellation } from "@/lib/errors";
import { track } from "@/lib/telemetry";
import type { PieceId } from "@/lib/game/types";

import type { BadgeSheet } from "@/components/exercises/badge-sheet";

const BADGE_PIECE_ORDER: readonly PieceId[] = [
  "rook",
  "bishop",
  "knight",
  "pawn",
  "queen",
  "king",
] as const;
const BADGE_LEVEL_IDS = [1n, 2n, 3n, 4n, 5n, 6n] as const;

type SignatureResponse =
  | { nonce: string; deadline: string; signature: `0x${string}`; error?: never }
  | { error: string };

async function requestBadgeSignature(body: {
  player: `0x${string}`;
  levelId: number;
}): Promise<{ nonce: string; deadline: string; signature: `0x${string}` }> {
  const response = await fetch("/api/sign-badge", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = (await response.json()) as SignatureResponse;
  if (!response.ok || "error" in payload) {
    throw new Error(payload.error ?? "Could not fetch signature");
  }
  return payload;
}

type BadgeSheetProps = Parameters<typeof BadgeSheet>[0];

export type UseBadgeSheetStateReturn = {
  open: boolean;
  openSheet: () => void;
  closeSheet: () => void;
  /** Per-piece claimed state derived from on-chain `hasClaimedBadge`
   *  reads. Surfaced separately from `sheetProps.badgesClaimed` so hosts
   *  (e.g. the V2 mastery dashboard) can drive tile state without
   *  destructuring sheet-only props. Updates flow through the same
   *  `useReadContracts` cycle as the sheet — no second on-chain fetch. */
  badgesClaimed: Record<PieceId, boolean | undefined>;
  /** Spread directly onto `<BadgeSheet />`. Caller still owns the
   *  navigation target for "View trophies" because that route lives
   *  outside the badges domain. */
  sheetProps: BadgeSheetProps;
};

export type UseBadgeSheetStateOptions = {
  /** Wired to the "View trophies" footer button. Scaffold passes
   *  `() => router.push('/trophies')`. */
  onNavigateToTrophies: () => void;
};

/** BadgeSheet orchestration extracted from `<ExercisesScreen>` so the
 *  redesigned `<HubScaffoldClient>` can render the badge claim flow
 *  in-place — same pattern used by `useProSheetState` (port 2026-05-07).
 *
 *  Owns the wagmi reads + claim signature flow + claim transaction.
 *  Emits the same `badge_claim_tx` telemetry stages as the legacy host
 *  so funnel reporting stays continuous across the migration window.
 *  Skipped (deferred to follow-up): the post-claim ResultOverlay and
 *  the next-piece unlock celebration — both depend on ExercisesScreen
 *  state machinery (boards, exercises) that doesn't exist on the
 *  scaffold surface yet. */
export function useBadgeSheetState({
  onNavigateToTrophies,
}: UseBadgeSheetStateOptions): UseBadgeSheetStateReturn {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();

  const configuredChainId = useMemo(() => getConfiguredChainId(), []);
  const isCorrectChain =
    configuredChainId != null && chainId === configuredChainId;
  const badgesAddress = useMemo(() => getBadgesAddress(chainId), [chainId]);
  const feeCurrency = useMemo(() => getMiniPayFeeCurrency(chainId), [chainId]);

  const { writeContractAsync: writeBadgeAsync, isPending: isBadgeWriting } =
    useWriteContract();

  const { data: allBadgesData, refetch: refetchBadges } = useReadContracts({
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

  const badgesClaimed = useMemo<Record<PieceId, boolean | undefined>>(() => {
    const map: Partial<Record<PieceId, boolean | undefined>> = {};
    BADGE_PIECE_ORDER.forEach((piece, idx) => {
      const result = allBadgesData?.[idx]?.result;
      map[piece] = typeof result === "boolean" ? result : undefined;
    });
    return map as Record<PieceId, boolean | undefined>;
  }, [allBadgesData]);

  const [open, setOpen] = useState(false);
  const [claimingPiece, setClaimingPiece] = useState<PieceId | null>(null);
  const isClaimBusy = isBadgeWriting || claimingPiece !== null;
  /** Set on success for ~2.5s, then cleared. Drives the inline success
   *  banner inside `<BadgeSheet>` — the scaffold has no global
   *  ResultOverlay yet, so this is the celebration moment. */
  const [lastClaimedPiece, setLastClaimedPiece] = useState<PieceId | null>(
    null,
  );
  const successTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>();
  useEffect(() => {
    return () => {
      if (successTimerRef.current) clearTimeout(successTimerRef.current);
    };
  }, []);

  const openSheet = useCallback(() => setOpen(true), []);
  const closeSheet = useCallback(() => {
    if (isClaimBusy) return;
    setOpen(false);
  }, [isClaimBusy]);

  const handleClaim = useCallback(
    async (piece: PieceId) => {
      const claimLevelId = getLevelId(piece);
      if (
        !address ||
        !badgesAddress ||
        !isConnected ||
        !isCorrectChain ||
        claimLevelId <= 0n
      ) {
        return;
      }
      // Defensive: don't double-claim a badge already on-chain or while
      // another claim is in-flight.
      if (badgesClaimed[piece] || isClaimBusy) return;

      setClaimingPiece(piece);
      track("badge_claim_tx", { stage: "start", piece });
      try {
        const signed = await requestBadgeSignature({
          player: address,
          levelId: Number(claimLevelId),
        });

        // MiniPay path injects `feeCurrency` so the user can pay gas in
        // a stablecoin. Mirror the ExercisesScreen helper: try fee-managed
        // first; on failure fall back to native gas. Falls through any
        // non-fee-related error to the catch below.
        const baseRequest = {
          address: badgesAddress,
          abi: badgesAbi,
          functionName: "claimBadgeSigned" as const,
          args: [
            claimLevelId,
            BigInt(signed.nonce),
            BigInt(signed.deadline),
            signed.signature,
          ] as const,
          chainId,
          account: address,
        };

        let txHash: `0x${string}`;
        try {
          const feeManaged = feeCurrency
            ? ({ ...baseRequest, feeCurrency } as unknown as typeof baseRequest)
            : baseRequest;
          txHash = await writeBadgeAsync(feeManaged);
        } catch (err) {
          if (!feeCurrency) throw err;
          txHash = await writeBadgeAsync(baseRequest);
        }

        hapticSuccess();
        track("badge_claim_tx", { stage: "success", piece });
        void refetchBadges();
        setLastClaimedPiece(piece);
        // Replace any pending timer so a quick second claim resets the
        // banner to the freshest success rather than letting the prior
        // one clear it underneath.
        if (successTimerRef.current) clearTimeout(successTimerRef.current);
        successTimerRef.current = setTimeout(() => {
          setLastClaimedPiece(null);
        }, 2500);
      } catch (error) {
        if (isUserCancellation(error)) {
          track("badge_claim_tx", { stage: "cancelled", piece });
          return;
        }
        track("badge_claim_tx", { stage: "error", piece });
      } finally {
        setClaimingPiece(null);
      }
    },
    [
      address,
      badgesAddress,
      isConnected,
      isCorrectChain,
      badgesClaimed,
      isClaimBusy,
      chainId,
      writeBadgeAsync,
      feeCurrency,
      refetchBadges,
    ],
  );

  const sheetProps: BadgeSheetProps = {
    open,
    onOpenChange: (next: boolean) => {
      if (next) openSheet();
      else closeSheet();
    },
    badgesClaimed,
    onClaim: (piece) => void handleClaim(piece),
    isClaimBusy,
    claimingPiece,
    lastClaimedPiece,
    showNotification: false,
    onNavigateToTrophies,
    // Scaffold owns the open state. The legacy dock-style trigger
    // button is suppressed here; otherwise Radix renders an orphan
    // `<button aria-label="Badges">` next to `<HubScaffold>` in the
    // layout tree (red-team P0-1).
    showTrigger: false,
  };

  return { open, openSheet, closeSheet, badgesClaimed, sheetProps };
}
