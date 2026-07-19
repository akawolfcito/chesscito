"use client";

import { useQuery } from "@tanstack/react-query";

export type ProStatus = {
  active: boolean;
  expiresAt: number | null;
};

export type UseProStatusReturn = {
  status: ProStatus | null;
  isLoading: boolean;
  refetch: () => void;
};

export const proStatusQueryKey = (wallet: string | undefined) =>
  ["pro-status", wallet ?? null] as const;

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
  const query = useQuery({
    queryKey: proStatusQueryKey(wallet),
    enabled: Boolean(wallet),
    retry: false,
    queryFn: async ({ signal }) => {
      const res = await fetch(`/api/pro/status?wallet=${wallet}`, { signal });
      if (!res.ok) throw new Error(`PRO status ${res.status}`);
      return await res.json() as ProStatus;
    },
  });

  return {
    status: wallet ? query.data ?? null : null,
    isLoading: Boolean(wallet) && query.isFetching,
    refetch: () => {
      void query.refetch();
    },
  };
}
