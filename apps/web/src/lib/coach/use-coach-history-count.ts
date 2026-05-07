import { useCallback, useEffect, useState } from "react";

/**
 * Read the wallet's Coach history entry count via GET /api/coach/history.
 *
 * Returns:
 * - `rowCount`: number when fetch succeeds, `undefined` while loading or
 *   when no wallet is supplied.
 * - `isLoading`: true while the in-flight request resolves.
 * - `refetch`: stable callback to re-run the request (used after delete
 *   to flip the disabled-button gate, red-team P0-7).
 *
 * Fail-soft: any fetch/network error resolves `rowCount` to 0 — same UX
 * as "you have nothing to delete" so the button stays disabled. Spec §9.2.
 */
export function useCoachHistoryCount(walletAddress: string | undefined): {
  rowCount: number | undefined;
  isLoading: boolean;
  refetch: () => void;
} {
  const [rowCount, setRowCount] = useState<number | undefined>(undefined);
  const [isLoading, setIsLoading] = useState<boolean>(walletAddress !== undefined);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!walletAddress) {
      setRowCount(undefined);
      setIsLoading(false);
      return;
    }
    let cancelled = false;
    setIsLoading(true);
    fetch(`/api/coach/history?wallet=${walletAddress}`)
      .then((r) => r.json())
      .then((data: unknown) => {
        if (cancelled) return;
        setRowCount(Array.isArray(data) ? data.length : 0);
      })
      .catch(() => {
        if (cancelled) return;
        setRowCount(0);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [walletAddress, tick]);

  const refetch = useCallback(() => setTick((t) => t + 1), []);

  return { rowCount, isLoading, refetch };
}
