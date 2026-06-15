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
 *  - Network / 4xx / 5xx PRESERVE the last-known status (they do not
 *    overwrite it). A transient failure must never demote an active PRO
 *    user to inactive; the value self-heals on the next OK fetch. On a
 *    first-load failure status stays null so useIsProActive can fall
 *    back to its localStorage cache. */
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
      .then(async (res) => {
        if (controller.signal.aborted) return;
        // Only an authoritative OK body mutates status. A transient
        // non-ok (403 rate-limit, 500, cold function) must NOT demote a
        // PRO user: we PRESERVE the last-known status so a single blip
        // while navigating the hub never flips the PRO chip to inactive.
        // The status self-heals on the next successful fetch. On a
        // first-load failure status stays null, letting useIsProActive
        // fall back to its localStorage cache.
        if (res.ok) {
          const data: ProStatus = await res.json();
          if (controller.signal.aborted) return;
          setStatus(data);
        }
        setIsLoading(false);
      })
      .catch((err: unknown) => {
        if (err instanceof Error && err.name === "AbortError") return;
        // Network error / malformed body — preserve last-known status
        // for the same reason as a non-ok response above.
        setIsLoading(false);
      });

    return () => controller.abort();
  }, [wallet, version]);

  const refetch = useCallback(() => {
    setVersion((v) => v + 1);
  }, []);

  return { status, isLoading, refetch };
}
