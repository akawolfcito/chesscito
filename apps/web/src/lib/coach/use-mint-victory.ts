"use client";

import { useCallback, useRef, useState } from "react";

export type ClaimPhase = "ready" | "claiming" | "success" | "error" | "cancelled" | "timeout";
export type ClaimStep = "signing" | "confirming" | "done";
export type ShareStatus = "locked" | "generating" | "ready";

export type ClaimData = {
  tokenId: string | null; // serialized bigint
  claimTxHash: `0x${string}` | null;
  shareCardUrl: string | null;
  shareLinkUrl: string | null;
};

export type MintVictoryInjected = {
  address?: `0x${string}`;
  chainId?: number;
  sendSig?: (typedData: unknown) => Promise<`0x${string}`>;
  sendApprove?: (token: `0x${string}`, amount: bigint) => Promise<`0x${string}`>;
  sendMint?: (signed: unknown) => Promise<`0x${string}`>;
  waitReceipt?: (hash: `0x${string}`) => Promise<unknown>;
};

export type MintVictoryInput = {
  gameId?: string;
  walletAddress?: `0x${string}`;
  difficulty?: "easy" | "medium" | "hard";
  result?: "win";
  totalMoves?: number;
  elapsedMs?: number;
  /** Consumer override for VR fixtures + tests. */
  injected?: MintVictoryInjected;
  /** Consumer fires telemetry — hook is side-effect-free for tracking. */
  onClaimTelemetry?: (event: {
    stage: "signing" | "submitted" | "confirmed" | "failed" | "cancelled" | "timeout";
    gameId?: string;
    txHash?: `0x${string}`;
    error?: string;
  }) => void;
};

export type MintVictoryState = {
  phase: ClaimPhase;
  step: ClaimStep;
  data: ClaimData;
  shareStatus: ShareStatus;
  error: string | null;
  start: () => Promise<void>;
  reset: () => void;
};

/**
 * Mint victory claim phase machine — SKELETON. Real logic is
 * transplanted from arena/page.tsx in commit T6b. This stub
 * satisfies the interface and is referentially stable across
 * renders. Behind feature flag NEXT_PUBLIC_USE_EXTRACTED_MINT_HOOK
 * — default OFF, legacy inline path in arena/page.tsx is the
 * source of truth until T6b.
 *
 * @remarks
 * Single-game mount expectation: state initializes on mount and
 * does not auto-reset when input identity changes. Pass `key={gameId}`
 * to force remount between games.
 */
export function useMintVictory(_input: MintVictoryInput): MintVictoryState {
  const [phase, setPhase] = useState<ClaimPhase>("ready");
  const claimingRef = useRef(false);

  const start = useCallback(async () => {
    // STUB: real impl transplants handleClaimVictory from
    // arena/page.tsx:879-1090 in T6b.
  }, []);

  const reset = useCallback(() => {
    claimingRef.current = false;
    setPhase("ready");
  }, []);

  return {
    phase,
    step: "signing",
    data: { tokenId: null, claimTxHash: null, shareCardUrl: null, shareLinkUrl: null },
    shareStatus: "locked",
    error: null,
    start,
    reset,
  };
}
