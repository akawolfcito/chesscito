"use client";

import { useCallback, useEffect, useState } from "react";
import { CHESSCITO_LITE_MODE } from "@/lib/feature-flags";
import { DEFAULT_STATE, getWelcomePackageState, setWelcomePackageState } from "./storage";
import type { WelcomePackageState } from "./types";

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

  // Sync from storage after hydration (handles cross-tab or re-mount).
  useEffect(() => {
    if (!CHESSCITO_LITE_MODE) return;
    setState(initState());
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const unlock = useCallback(() => {
    if (!CHESSCITO_LITE_MODE) return;
    setState((prev) => {
      if (prev.unlocked) return prev; // idempotent
      const next: WelcomePackageState = {
        ...prev,
        unlocked: true,
        unlockedAt: new Date().toISOString(),
      };
      setWelcomePackageState(next);
      return next;
    });
  }, []);

  const claim = useCallback(() => {
    if (!CHESSCITO_LITE_MODE) return;
    setState((prev) => {
      const next: WelcomePackageState = {
        ...prev,
        claimed: true,
        claimedAt: new Date().toISOString(),
      };
      setWelcomePackageState(next);
      return next;
    });
  }, []);

  const dismiss = useCallback(() => {
    if (!CHESSCITO_LITE_MODE) return;
    setState((prev) => {
      const next: WelcomePackageState = {
        ...prev,
        dismissed: true,
        dismissedAt: new Date().toISOString(),
        dismissCount: prev.dismissCount + 1,
      };
      setWelcomePackageState(next);
      return next;
    });
  }, []);

  const markShown = useCallback(() => {
    if (!CHESSCITO_LITE_MODE) return;
    setState((prev) => {
      const next: WelcomePackageState = {
        ...prev,
        autoShowCount: prev.autoShowCount + 1,
      };
      setWelcomePackageState(next);
      return next;
    });
  }, []);

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
