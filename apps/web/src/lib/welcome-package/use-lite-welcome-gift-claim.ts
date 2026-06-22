"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAccount, useSignMessage } from "wagmi";
import type { ClaimPhase } from "@/components/welcome-package/welcome-package-modal";

export type UseLiteWelcomeGiftClaimReturn = {
  claimPhase: ClaimPhase;
  handleClaim: (onClaimed: () => void) => void;
  handleRetry: () => void;
  handleSuccess: () => void;
};

function buildConfirmMessage(address: string, isoTimestamp: string): string {
  return `Chesscito Welcome Gift — confirmed for ${address} at ${isoTimestamp}`;
}

/**
 * Orchestrates the Lite Welcome Gift claim moment:
 *   idle → signing (personal_sign prompt) → success | error
 *
 * The signature is the "moment" — no on-chain write or API call in B1.1.
 * `onClaimed` callback (passed per-call) runs once on fresh success so the
 * caller can sync local state (e.g. useWelcomePackage.claim()).
 *
 * Falls back to immediate success when wallet is unavailable (graceful
 * degradation for non-MiniPay environments).
 */
export function useLiteWelcomeGiftClaim(): UseLiteWelcomeGiftClaimReturn {
  const { address } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const [claimPhase, setClaimPhase] = useState<ClaimPhase>("idle");
  const isMountedRef = useRef(true);
  useEffect(() => () => { isMountedRef.current = false; }, []);

  const handleClaim = useCallback(
    (onClaimed: () => void) => {
      if (claimPhase !== "idle") return;

      // No wallet: skip signature, treat as immediate success.
      if (!address) {
        onClaimed();
        setClaimPhase("success");
        return;
      }

      setClaimPhase("signing");
      const isoTimestamp = new Date().toISOString();
      const message = buildConfirmMessage(address, isoTimestamp);

      signMessageAsync({ message })
        .then(() => {
          if (!isMountedRef.current) return;
          onClaimed();
          setClaimPhase("success");
        })
        .catch(() => {
          if (!isMountedRef.current) return;
          setClaimPhase("error");
        });
    },
    [address, claimPhase, signMessageAsync],
  );

  const handleRetry = useCallback(() => {
    setClaimPhase("idle");
  }, []);

  const handleSuccess = useCallback(() => {
    setClaimPhase("idle");
  }, []);

  return { claimPhase, handleClaim, handleRetry, handleSuccess };
}
