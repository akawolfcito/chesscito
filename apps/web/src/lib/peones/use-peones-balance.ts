"use client";

/**
 * usePeonesBalance — read-only hook backing the HUD balance chip.
 *
 * Sprint 3 commit G of Training Economy Alpha 2026-06-07. Fetches
 * `/api/peones/balance` for the currently-connected wallet and
 * exposes a small state machine the chip can render directly:
 *
 *  - guest    : no wallet connected. NO fetch is issued, NO state
 *               change beyond "guest". Chip MUST hide entirely.
 *  - loading  : initial mount or post-wallet-change refetch in flight.
 *  - success  : endpoint returned 200. Carries balance, cap data,
 *               and lastEventAt.
 *  - error    : network fault / non-2xx / bad JSON / malformed
 *               wallet. Chip renders the discrete "--" fallback;
 *               NEVER an aggressive error banner.
 *
 * Polling: still NO interval. The hook fetches on
 * - the initial mount,
 * - a change of isConnected + address,
 * - a `chesscito:peones-changed` event (see `peones-events.ts`).
 *
 * That third trigger is edge-driven, not polling (Peones V1 UX,
 * 2026-07-21). Every confirmed earn/spend dispatches it, so a debit in
 * the /exercises action row moves the chip in the tray above the board
 * without waiting for a remount. Superseded the original Sprint 3 rule
 * ("earn flows rely on the next mount of the chip"), which is exactly
 * why a player never saw the balance move.
 *
 * NO localStorage write. The endpoint response IS the source of
 * truth. If callers want optimism after a write, they can manage
 * that locally — this hook stays straight read-only.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAccount } from "wagmi";

import { normalizeWallet } from "./ledger-service";
import { subscribeToPeonesChanges } from "./peones-events";
import { PEONES_DAILY_CAP } from "./types";

export type PeonesBalanceState =
  | { kind: "guest" }
  | { kind: "loading" }
  | {
      kind: "success";
      balance: number;
      dailyEarnedCapped: number;
      dailyCap: number;
      lastEventAt: string | null;
    }
  | { kind: "error" };

export type UsePeonesBalanceOptions = {
  /** Override for testing. Defaults to the global `fetch`. */
  fetchImpl?: typeof fetch;
};

export function usePeonesBalance(
  options?: UsePeonesBalanceOptions,
): { state: PeonesBalanceState; refetch: () => Promise<void> } {
  const { isConnected, address } = useAccount();
  const fetchImpl = options?.fetchImpl;

  // Memoise the fetch function so callers using `useEffect`'s dep
  // array on `refetch` don't trip on identity churn from the
  // default-vs-injected pattern.
  const doFetch = useMemo<typeof fetch>(
    () => fetchImpl ?? ((input, init) => fetch(input, init)),
    [fetchImpl],
  );

  const [state, setState] = useState<PeonesBalanceState>(() =>
    isConnected && address ? { kind: "loading" } : { kind: "guest" },
  );

  const refetch = useCallback(async () => {
    if (!isConnected || !address) {
      setState({ kind: "guest" });
      return;
    }

    let wallet: string;
    try {
      wallet = normalizeWallet(address);
    } catch {
      // Defensive: an invalid address from wagmi would be a bug, but
      // we surface as error instead of throwing into the render.
      setState({ kind: "error" });
      return;
    }

    setState({ kind: "loading" });

    let res: Response;
    try {
      res = await doFetch(
        `/api/peones/balance?wallet=${encodeURIComponent(wallet)}`,
      );
    } catch {
      setState({ kind: "error" });
      return;
    }

    if (!res.ok) {
      setState({ kind: "error" });
      return;
    }

    let json: {
      balance?: unknown;
      dailyEarnedCapped?: unknown;
      dailyCap?: unknown;
      lastEventAt?: unknown;
    };
    try {
      json = await res.json();
    } catch {
      setState({ kind: "error" });
      return;
    }

    setState({
      kind: "success",
      balance: Number(json.balance ?? 0),
      dailyEarnedCapped: Number(json.dailyEarnedCapped ?? 0),
      dailyCap: Number(json.dailyCap ?? PEONES_DAILY_CAP),
      lastEventAt:
        typeof json.lastEventAt === "string" ? json.lastEventAt : null,
    });
  }, [isConnected, address, doFetch]);

  // Initial fetch + wallet-change refetch. No interval. Strict mode
  // double-invoke is harmless because the second call lands in the
  // same Supabase row and the server-side rate-limit is read-style
  // (lenient IP bucket).
  useEffect(() => {
    void refetch();
  }, [refetch]);

  // Balance-change bus (Peones V1 UX, 2026-07-21). Still no interval —
  // this is edge-triggered, not polling. A confirmed earn/spend anywhere
  // in the tree dispatches, and every mounted reader re-reads the server.
  // Without this, a spend in the /exercises action row leaves the chip in
  // the tray above the board showing the pre-spend number until remount.
  //
  // Guests short-circuit inside `refetch` (no wallet → no request), so a
  // stray dispatch cannot make a disconnected chip hit the endpoint.
  useEffect(() => {
    return subscribeToPeonesChanges(() => {
      void refetch();
    });
  }, [refetch]);

  return { state, refetch };
}
