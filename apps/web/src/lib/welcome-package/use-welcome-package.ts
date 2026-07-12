"use client";

import { useCallback, useEffect, useState } from "react";
import { CHESSCITO_LITE_MODE } from "@/lib/feature-flags";
import { DEFAULT_STATE, getWelcomePackageState, setWelcomePackageState } from "./storage";
import type { WelcomePackageState } from "./types";
import { subscribeToWelcomePackageChanges } from "./welcome-package-events";

export interface UseWelcomePackageReturn {
  isUnlocked: boolean;
  isClaimed: boolean;
  isPending: boolean;
  shouldAutoShow: boolean;
  unlock: () => void;
  claim: () => void;
  dismiss: () => void;
  markShown: () => void;
}

function noop() {}

const NOOP_RETURN: UseWelcomePackageReturn = {
  isUnlocked: false,
  isClaimed: false,
  isPending: false,
  shouldAutoShow: false,
  unlock: noop,
  claim: noop,
  dismiss: noop,
  markShown: noop,
};

function initState(): WelcomePackageState {
  if (typeof window === "undefined" || !CHESSCITO_LITE_MODE) return { ...DEFAULT_STATE };

  return getWelcomePackageState();
}

export function useWelcomePackage(): UseWelcomePackageReturn {
  const [state, setState] = useState<WelcomePackageState>(initState);

  // Sync from storage after hydration (handles cross-tab or re-mount) AND
  // stay subscribed: storage — not this hook — is the owner. Another writer
  // in the same tree (`claimWelcomePackageGift()` on the exercises screen)
  // moves the key without going through us; without this subscription our
  // snapshot rots and the next writer spreads a stale `claimed: false` back
  // over it. Same bus, same reason as `lib/shop/shield-events`.
  useEffect(() => {
    if (!CHESSCITO_LITE_MODE) return;
    const reread = () => setState(getWelcomePackageState());
    reread();
    return subscribeToWelcomePackageChanges(reread);
  }, []);

  /** Every writer re-reads COMMITTED storage first. Spreading React state
   *  here would rewrite the whole object from a snapshot that another writer
   *  may have already superseded. Returning `null` means "no change". */
  const write = useCallback(
    (mutate: (prev: WelcomePackageState) => WelcomePackageState | null) => {
      if (!CHESSCITO_LITE_MODE) return;
      const prev = getWelcomePackageState();
      const next = mutate(prev);
      if (!next) {
        setState(prev);
        return;
      }
      // Writes, THEN dispatches — the subscription above re-reads.
      setWelcomePackageState(next);
      setState(next);
    },
    [],
  );

  const unlock = useCallback(() => {
    write((prev) =>
      prev.unlocked
        ? null // idempotent
        : { ...prev, unlocked: true, unlockedAt: new Date().toISOString() },
    );
  }, [write]);

  const claim = useCallback(() => {
    write((prev) => ({
      ...prev,
      claimed: true,
      claimedAt: new Date().toISOString(),
    }));
  }, [write]);

  const dismiss = useCallback(() => {
    write((prev) => ({
      ...prev,
      dismissed: true,
      dismissedAt: new Date().toISOString(),
      dismissCount: prev.dismissCount + 1,
    }));
  }, [write]);

  const markShown = useCallback(() => {
    write((prev) => ({ ...prev, autoShowCount: prev.autoShowCount + 1 }));
  }, [write]);

  if (!CHESSCITO_LITE_MODE) return NOOP_RETURN;

  return {
    isUnlocked: state.unlocked,
    isClaimed: state.claimed,
    isPending: state.unlocked && !state.claimed,
    shouldAutoShow: state.unlocked && !state.claimed && state.autoShowCount < 2,
    unlock,
    claim,
    dismiss,
    markShown,
  };
}
