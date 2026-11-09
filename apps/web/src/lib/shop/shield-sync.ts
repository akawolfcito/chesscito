/** Server → client reconciliation of the `credited` shield counter.
 *
 *  `credited` is a monotonic counter owned by Redis; the client keeps a
 *  mirror in localStorage and derives the displayed count from it
 *  (`min(MAX_SHIELDS, credited - consumed)`, see shield-storage.ts). Any
 *  flow that credits shields server-side MUST push the new counter back
 *  into that mirror, or the HUD keeps rendering the pre-purchase value
 *  until some other screen remounts `useShieldSync`.
 *
 *  Plain functions, not a hook: the Season Pass rail needs to reconcile
 *  from inside a callback, and mounting a second `useShieldSync` in the
 *  same tree would duplicate a cache+fetch hook. */

import { dispatchShieldChange } from "@/lib/shop/shield-events";
import { writeCreditedCache } from "@/lib/shop/shield-storage";

type ShieldsMeResponse = { ok?: boolean; credited?: number };

/** Caches an absolute counter the server already handed us (e.g. the
 *  Redis INCRBY return that `/api/welcome-pack/claim` echoes back) and
 *  notifies the in-tab subscribers. Never pass a delta here. */
export function applyServerCredited(credited: number): void {
  writeCreditedCache(credited);
  dispatchShieldChange();
}

/** Reads the authoritative counter for `address` and mirrors it locally.
 *  Returns the counter, or null when the read failed — a failure leaves
 *  the cache untouched, so the next sync (or boot) still reconciles. */
export async function syncShieldsFromServer(
  address: string,
): Promise<number | null> {
  try {
    const res = await fetch(
      `/api/shields/me?wallet=${encodeURIComponent(address)}`,
    );
    if (!res.ok) return null;
    const data = (await res.json()) as ShieldsMeResponse;
    if (typeof data.credited !== "number") return null;
    applyServerCredited(data.credited);
    return data.credited;
  } catch {
    return null;
  }
}
