"use client";

import { useEffect, useState } from "react";

import { readDisplayedShields } from "@/lib/shop/shield-storage";
import { subscribeToShieldChanges } from "@/lib/shop/shield-events";

/**
 * Live shields count for the connected wallet.
 *
 * Reads from localStorage via `readDisplayedShields()` (which derives
 * `min(MAX, credited - consumed)` per the v2 counter model) and
 * subscribes to the in-tab `chesscito:shields-changed` event so the
 * UI re-renders when shields are credited (post-buy) or consumed
 * (retry flow) without needing a route reload.
 *
 * SSR safe: initial render returns 0; first client-side effect reads
 * localStorage and patches.
 */
export function useShieldsCount(): number {
  const [count, setCount] = useState<number>(0);

  useEffect(() => {
    setCount(readDisplayedShields());
    return subscribeToShieldChanges(() => {
      setCount(readDisplayedShields());
    });
  }, []);

  return count;
}
