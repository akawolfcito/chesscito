"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type ProStatus = {
  active: boolean;
  expiresAt: number | null;
};

export type UseProStatusReturn = {
  status: ProStatus | null;
  isLoading: boolean;
  refetch: () => void;
};

/** Read-only fetch hook for /api/pro/status. Used by the PRO chip and
 *  sheet to decide whether to render "Get PRO" vs "PRO active".
 *
 *  - No wallet → null status, no fetch (chip stays hidden / loading).
 *  - Wallet provided → fetch on mount, refetch on wallet change.
 *  - `refetch()` is exposed for callers to trigger after a successful
 *    /api/verify-pro response (so the chip flips to active immediately).
 *  - No automatic polling. Single-tab tabs that bought from another
 *    device will only update on next mount or manual refetch.
 *  - Network / 4xx / 5xx are treated as "inactive" so a flaky API never
 *    forces the UI into an error state. */
export function useProStatus(wallet?: string): UseProStatusReturn {
  const [status, setStatus] = useState<ProStatus | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [version, setVersion] = useState(0);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!wallet) {
      setStatus(null);
      setIsLoading(false);
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setIsLoading(true);

    fetch(`/api/pro/status?wallet=${wallet}`, { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : { active: false, expiresAt: null }))
      .then((data: ProStatus) => {
        if (controller.signal.aborted) return;
        setStatus(data);
        setIsLoading(false);
      })
      .catch((err: unknown) => {
        if (err instanceof Error && err.name === "AbortError") return;
        setStatus({ active: false, expiresAt: null });
        setIsLoading(false);
      });

    return () => controller.abort();
  }, [wallet, version]);

  const refetch = useCallback(() => {
    setVersion((v) => v + 1);
  }, []);

  return { status, isLoading, refetch };
}
