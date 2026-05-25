"use client";

import { useEffect, useState } from "react";
import { useAccount } from "wagmi";

import { useProStatus } from "@/lib/pro/use-pro-status";

const STORAGE_PREFIX = "chesscito:pro-active:";

function storageKey(wallet: string): string {
  return `${STORAGE_PREFIX}${wallet.toLowerCase()}`;
}

/**
 * Boolean flag for "is the connected wallet currently a PRO subscriber?"
 *
 * Wraps `useProStatus(address)` with three conveniences any UI layer
 * gating itself on PRO needs:
 *
 *  1. Single-import contract — `const isPro = useIsProActive()` returns
 *     just the boolean. Consumers don't have to repeat the
 *     `status?.active && expiresAt > Date.now()` shape on every callsite.
 *
 *  2. Live expiry check — the API can report `active: true` with an
 *     already-past `expiresAt` if the user opened the app the moment
 *     their pass lapsed. Re-check against `Date.now()` so the UI flips
 *     to inactive without waiting for the server cache to invalidate.
 *
 *  3. localStorage cache to suppress the "no PRO" flash on every
 *     mount. The fetch resolves async; before it does, the UI would
 *     paint the inactive variant for ~200ms then swap to the PRO
 *     variant, which looks like an unwanted flicker for paying users.
 *     The cache reads the last known active state synchronously on
 *     first render so PRO users see the right variant immediately.
 *     The fetch still runs and overrides the cached value if it
 *     disagrees — the cache is an opening guess, not the source of truth.
 *
 * No wallet connected → returns `false` (no claim to PRO state exists).
 */
export function useIsProActive(): boolean {
  const { address } = useAccount();
  const wallet = address?.toLowerCase();
  const { status } = useProStatus(wallet);

  // Sync read on first render — avoids the inactive→active flicker for
  // returning PRO users. Safe inside `useState` initializer (runs once
  // per mount); guarded for SSR (`window` undefined).
  const [cachedActive, setCachedActive] = useState<boolean>(() => {
    if (typeof window === "undefined" || !wallet) return false;
    try {
      return window.localStorage.getItem(storageKey(wallet)) === "1";
    } catch {
      return false;
    }
  });

  // Compute the server-truth value with the live expiry check baked in.
  const serverActive =
    status?.active === true &&
    status.expiresAt !== null &&
    status.expiresAt > Date.now();

  // Write-through to localStorage whenever the server result changes.
  // Skips when `status === null` (still loading / no wallet) so the
  // cache survives transient null states between wallet swaps.
  useEffect(() => {
    if (!wallet || status === null) return;
    try {
      if (serverActive) {
        window.localStorage.setItem(storageKey(wallet), "1");
      } else {
        window.localStorage.removeItem(storageKey(wallet));
      }
    } catch {
      // Quota-exceeded / disabled storage — fall through; the in-memory
      // `serverActive` value still drives the current render.
    }
    setCachedActive(serverActive);
  }, [wallet, status, serverActive]);

  // Server answer wins once it lands. Cache only matters during the
  // brief window before the first fetch resolves.
  return status === null ? cachedActive : serverActive;
}
