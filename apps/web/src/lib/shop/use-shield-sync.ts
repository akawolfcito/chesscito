"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAccount } from "wagmi";

import { dispatchShieldChange } from "@/lib/shop/shield-events";
import {
  consumeLegacyShieldsForMigration,
  readPendingTxs,
  dequeuePendingTx,
  writeCreditedCache,
  SHIELDS_CONSUMED_KEY,
  SHIELDS_LEGACY_KEY,
  SHIELDS_CREDITED_CACHE_KEY,
} from "@/lib/shop/shield-storage";

export type UseShieldSyncReturn = {
  /** Last server-confirmed `credited`, null until first sync resolves. */
  serverCredited: number | null;
  /** Manual trigger (e.g., right after a credit-shield write). */
  refresh: () => Promise<void>;
};

type CreditShieldOk = {
  ok: true;
  credited: number;
  delta: number;
  txHash: string;
};

type ShieldsMeOk = { ok: true; credited: number };

/** Boot-time + post-purchase shield reconciliation hook. Spec §
 *  "useShieldSync sequence":
 *   1. Drain `readPendingTxs()` via POST /api/credit-shield. Dequeue
 *      ONLY on 2xx (red-team v2 P0 — `unprocessable` is collapsed
 *      and mixes terminal + transient cases). TTL + ring-buffer
 *      evict permanently-bad txs organically.
 *   2. One-shot legacy migration: forfeit-and-clear.
 *   3. GET /api/shields/me → writeCreditedCache + dispatch. */
export function useShieldSync(): UseShieldSyncReturn {
  const { address, isConnected } = useAccount();
  const [serverCredited, setServerCredited] = useState<number | null>(null);
  const syncingRef = useRef(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const sync = useCallback(async () => {
    if (syncingRef.current) return;
    if (!isConnected || !address) return;
    syncingRef.current = true;
    try {
      // 1. Drain pending queue.
      const queued = readPendingTxs();
      for (const entry of queued) {
        try {
          const res = await fetch("/api/credit-shield", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              txHash: entry.txHash,
              walletAddress: address,
            }),
          });
          if (res.ok) {
            // 2xx (any delta, including 0) → dequeue.
            const data = (await res.json()) as CreditShieldOk;
            void data;
            dequeuePendingTx(entry.txHash);
          }
          // Any 4xx/5xx → leave queued; TTL/ring-buffer evicts.
        } catch {
          // Network failure → leave queued.
        }
      }

      // 2. Legacy migration (forfeit-and-clear).
      const legacy = consumeLegacyShieldsForMigration();
      if (legacy != null && typeof window !== "undefined") {
        try {
          window.localStorage.setItem(SHIELDS_CONSUMED_KEY, "0");
          window.localStorage.setItem(SHIELDS_CREDITED_CACHE_KEY, "0");
          window.localStorage.removeItem(SHIELDS_LEGACY_KEY);
        } catch {
          // ignore — next boot retries
        }
      }

      // 3. Read current credit total.
      try {
        const res = await fetch(
          `/api/shields/me?wallet=${encodeURIComponent(address)}`,
        );
        if (res.ok) {
          const data = (await res.json()) as ShieldsMeOk;
          if (mountedRef.current) {
            writeCreditedCache(data.credited);
            setServerCredited(data.credited);
            dispatchShieldChange();
          }
        }
      } catch {
        // ignore — next sync retries
      }
    } finally {
      syncingRef.current = false;
    }
  }, [address, isConnected]);

  useEffect(() => {
    void sync();
  }, [sync]);

  return { serverCredited, refresh: sync };
}
