"use client";

import { useEffect, useState } from "react";
import { useAccount } from "wagmi";

const STORAGE_PREFIX = "chesscito:founder-active:";
/** Founder ownership is permanent — once true it never flips back.
 *  Cache aggressively so the row paints owned on cold load without a
 *  network round-trip. The server cache TTL (24h) is the source of
 *  truth for refresh cadence; this local cache simply suppresses the
 *  inactive flash for known-owners. */
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

type FounderStatus = { ownsFounder: boolean; since: number | null };

function storageKey(wallet: string): string {
  return `${STORAGE_PREFIX}${wallet.toLowerCase()}`;
}

function readCache(wallet: string | undefined): boolean {
  if (typeof window === "undefined" || !wallet) return false;
  try {
    const raw = window.localStorage.getItem(storageKey(wallet));
    if (!raw) return false;
    const entry = JSON.parse(raw) as { active: boolean; ts: number };
    if (Date.now() - entry.ts > CACHE_TTL_MS) return false;
    return entry.active === true;
  } catch {
    return false;
  }
}

function writeCache(wallet: string, active: boolean): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      storageKey(wallet),
      JSON.stringify({ active, ts: Date.now() }),
    );
  } catch {
    /* storage unavailable — ignore */
  }
}

/**
 * Returns `true` when the connected wallet has ever purchased the
 * Founder Badge (itemId 1 stablecoin or 5 CELO sibling). Wraps
 * `GET /api/founder-status?wallet=...` with a localStorage cache to
 * suppress the inactive→owned flash for returning founders.
 *
 * No wallet → returns `false`. Network failure → falls back to cache
 * or `false`. The hook only cares about ownership, not the `since`
 * block field; that's reserved for a future "Founder since {date}"
 * surface.
 */
export function useFounderStatus(): boolean {
  const { address } = useAccount();
  const wallet = address?.toLowerCase();

  const [active, setActive] = useState<boolean>(() => readCache(wallet));

  useEffect(() => {
    if (!wallet) {
      setActive(false);
      return;
    }
    // Re-seed from cache when the wallet changes so we don't flash a
    // stale prior wallet's status.
    setActive(readCache(wallet));

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/founder-status?wallet=${wallet}`);
        if (!res.ok) return;
        const data = (await res.json()) as Partial<FounderStatus>;
        if (cancelled) return;
        const owns = data.ownsFounder === true;
        setActive(owns);
        writeCache(wallet, owns);
      } catch {
        // Network down — keep whatever the cache returned.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [wallet]);

  return active;
}
