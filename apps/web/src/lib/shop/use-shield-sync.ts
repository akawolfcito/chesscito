"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAccount } from "wagmi";

import { syncShieldsFromServer } from "@/lib/shop/shield-sync";
import {
  consumeLegacyShieldsForMigration,
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

/** Boot-time + post-purchase shield reconciliation hook. Spec §
 *  "useShieldSync sequence" (purchase-queue drain step retired in
 *  Task B8 alongside the Shop-TX purchase path):
 *   1. One-shot legacy migration: forfeit-and-clear.
 *   2. GET /api/shields/me → writeCreditedCache + dispatch. */
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
      // 1. Legacy migration (forfeit-and-clear).
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

      // 2. Read current credit total.
      const credited = await syncShieldsFromServer(address);
      if (credited != null && mountedRef.current) setServerCredited(credited);
    } finally {
      syncingRef.current = false;
    }
  }, [address, isConnected]);

  useEffect(() => {
    void sync();
  }, [sync]);

  return { serverCredited, refresh: sync };
}
