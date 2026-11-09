"use client";

import { useCallback, useEffect, useState } from "react";
import { useAccount } from "wagmi";

export type UseCoachCreditsResult = {
  /** Free Coach analyses remaining. 0 = paywall territory. PRO awareness
   *  is NOT baked in here; compose with `useIsProActive()` at the
   *  callsite when rendering the counter. */
  credits: number;
  /** True only while the first fetch is in flight AND no cached value is
   *  yet surfaced. After cache hydrate or fetch resolution, flips false. */
  isLoading: boolean;
  /** Last fetch errored (network or non-2xx). Cached credits (if any)
   *  remain in `credits` as a graceful fallback. */
  isError: boolean;
  /** Force-fetch, bypassing the cache TTL. Call after a successful
   *  `/api/coach/analyze` response or after a Coach pack purchase
   *  verify so the counter reflects the new balance immediately. */
  refetch: () => Promise<void>;
};

type CacheEntry = { credits: number; cachedAt: number };

const STORAGE_PREFIX = "chesscito:coach-credits:";
const TTL_MS = 5 * 60_000;

function storageKey(wallet: string): string {
  return `${STORAGE_PREFIX}${wallet.toLowerCase()}`;
}

function readCache(wallet: string): CacheEntry | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(storageKey(wallet));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CacheEntry;
    if (typeof parsed?.credits !== "number" || typeof parsed?.cachedAt !== "number") {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function writeCache(wallet: string, credits: number): void {
  if (typeof window === "undefined") return;
  try {
    const entry: CacheEntry = { credits, cachedAt: Date.now() };
    window.localStorage.setItem(storageKey(wallet), JSON.stringify(entry));
  } catch {
    /* quota / disabled storage — current render still has the value */
  }
}

function isFresh(entry: CacheEntry): boolean {
  return Date.now() - entry.cachedAt < TTL_MS;
}

export function useCoachCredits(): UseCoachCreditsResult {
  const { address } = useAccount();
  const wallet = address?.toLowerCase() ?? null;

  const [credits, setCredits] = useState<number>(() => {
    if (!wallet) return 0;
    return readCache(wallet)?.credits ?? 0;
  });
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isError, setIsError] = useState<boolean>(false);

  const fetchCredits = useCallback(
    async (force: boolean): Promise<void> => {
      if (!wallet) return;

      if (!force) {
        const cached = readCache(wallet);
        if (cached && isFresh(cached)) {
          setCredits(cached.credits);
          setIsLoading(false);
          setIsError(false);
          return;
        }
      }

      setIsLoading(true);
      setIsError(false);
      try {
        const res = await fetch(`/api/coach/credits?wallet=${wallet}`, { method: "GET" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as { credits?: unknown };
        const n = typeof data?.credits === "number" ? data.credits : 0;
        setCredits(n);
        writeCache(wallet, n);
        setIsError(false);
      } catch {
        setIsError(true);
      } finally {
        setIsLoading(false);
      }
    },
    [wallet],
  );

  useEffect(() => {
    if (!wallet) {
      setCredits(0);
      setIsError(false);
      setIsLoading(false);
      return;
    }
    void fetchCredits(false);
  }, [wallet, fetchCredits]);

  const refetch = useCallback(() => fetchCredits(true), [fetchCredits]);

  return { credits, isLoading, isError, refetch };
}
