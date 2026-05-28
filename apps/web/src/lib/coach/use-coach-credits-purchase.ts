"use client";

import { useCallback, useState } from "react";

export type CoachCreditsPurchaseInjected = {
  address?: `0x${string}`;
  chainId?: number;
  sendPurchase?: (itemId: number, paymentToken: `0x${string}`) => Promise<`0x${string}`>;
  tokenBalances?: Record<`0x${string}`, bigint>;
};

export type CoachCreditsPurchaseInput = {
  walletAddress?: `0x${string}`;
  injected?: CoachCreditsPurchaseInjected;
};

export type CoachCreditsPurchaseState = {
  isProcessing: boolean;
  error: string | null;
  buyCredits: (itemId: number) => Promise<void>;
};

/**
 * Coach credits purchase — SKELETON. Real logic is transplanted
 * from arena/page.tsx:768-862 (handleBuyCredits) in commit T5c.
 * Split out from useCoachAnalysis so the latter stays viewer-
 * portable without wagmi-write deps. Behind feature flag
 * NEXT_PUBLIC_USE_EXTRACTED_COACH_HOOKS — default OFF.
 */
export function useCoachCreditsPurchase(_input: CoachCreditsPurchaseInput): CoachCreditsPurchaseState {
  const [isProcessing] = useState(false);

  const buyCredits = useCallback(async (_itemId: number) => {
    // STUB: real impl in T5c
  }, []);

  return {
    isProcessing,
    error: null,
    buyCredits,
  };
}
