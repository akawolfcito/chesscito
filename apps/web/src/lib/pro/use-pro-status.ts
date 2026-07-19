"use client";

import { useQuery } from "@tanstack/react-query";

export type ProStatus = {
  active: boolean;
  expiresAt: number | null;
};

export type ProRemoteState =
  | "unknown"
  | "loading"
  | "active"
  | "inactive"
  | "error";

export type ProStatusError = {
  kind: "http" | "network" | "invalid-response";
  httpStatus: number | null;
  message: string;
};

export type UseProStatusReturn = {
  status: ProStatus | null;
  state: ProRemoteState;
  error: ProStatusError | null;
  /** Previous successful response retained by React Query after a failed
   * refetch. Diagnostic/presentation metadata only; never authorization. */
  staleStatus: ProStatus | null;
  isLoading: boolean;
  refetch: () => void;
};

class ProStatusRequestError extends Error {
  constructor(
    readonly details: ProStatusError,
  ) {
    super(details.message);
    this.name = "ProStatusRequestError";
  }
}

function isProStatus(value: unknown): value is ProStatus {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.active === "boolean" &&
    (candidate.expiresAt === null || typeof candidate.expiresAt === "number")
  );
}

export const normalizeProWallet = (wallet: string | undefined) =>
  wallet?.toLowerCase();

export const proStatusQueryKey = (wallet: string | undefined) =>
  ["pro-status", normalizeProWallet(wallet) ?? null] as const;

/** Read-only fetch hook for /api/pro/status. Used by the PRO chip and
 *  sheet to decide whether to render "Get PRO" vs "PRO active".
 *
 *  - No wallet → null status, no fetch (chip stays hidden / loading).
 *  - Wallet provided → fetch on mount, refetch on wallet change.
 *  - `refetch()` is exposed for callers to trigger after a successful
 *    /api/verify-pro response (so the chip flips to active immediately).
 *  - No automatic polling. Single-tab tabs that bought from another
 *    device will only update on next mount or manual refetch.
 *  - Network / 4xx / 5xx are explicit transport states. React Query may retain
 *    the last successful body, but it is exposed only as `staleStatus`; the
 *    authoritative `status` becomes null until another successful response. */
export function useProStatus(wallet?: string): UseProStatusReturn {
  const normalizedWallet = normalizeProWallet(wallet);
  const query = useQuery({
    queryKey: proStatusQueryKey(normalizedWallet),
    enabled: Boolean(normalizedWallet),
    retry: false,
    queryFn: async ({ signal }) => {
      let res: Response;
      try {
        res = await fetch(`/api/pro/status?wallet=${normalizedWallet}`, {
          signal,
        });
      } catch (error) {
        if ((error as Error)?.name === "AbortError") throw error;
        throw new ProStatusRequestError({
          kind: "network",
          httpStatus: null,
          message: "PRO status network request failed",
        });
      }
      if (!res.ok) {
        throw new ProStatusRequestError({
          kind: "http",
          httpStatus: res.status,
          message: `PRO status request failed (${res.status})`,
        });
      }
      let body: unknown;
      try {
        body = await res.json();
      } catch {
        throw new ProStatusRequestError({
          kind: "invalid-response",
          httpStatus: res.status,
          message: "PRO status response was not valid JSON",
        });
      }
      if (!isProStatus(body)) {
        throw new ProStatusRequestError({
          kind: "invalid-response",
          httpStatus: res.status,
          message: "PRO status response had an invalid shape",
        });
      }
      return body;
    },
  });

  const requestError =
    query.error instanceof ProStatusRequestError
      ? query.error.details
      : query.isError
        ? {
            kind: "network" as const,
            httpStatus: null,
            message: "PRO status request failed",
          }
        : null;
  const failed = Boolean(normalizedWallet) && query.isError;
  const state: ProRemoteState = !normalizedWallet
    ? "unknown"
    : failed
      ? requestError?.kind === "http"
        ? "error"
        : "unknown"
      : query.data
        ? query.data.active
          ? "active"
          : "inactive"
        : "loading";

  return {
    status: normalizedWallet && !failed ? query.data ?? null : null,
    state,
    error: requestError,
    staleStatus: failed ? query.data ?? null : null,
    isLoading: Boolean(normalizedWallet) && query.isFetching,
    refetch: () => {
      void query.refetch();
    },
  };
}
