"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAccount } from "wagmi";

import { useShieldsCount } from "@/lib/shop/use-shields-count";
import { useWelcomePackClaim } from "@/lib/shop/use-welcome-pack-claim";
import { dispatchShieldChange } from "@/lib/shop/shield-events";
import {
  readConsumedCount,
  writeCreditedCache,
} from "@/lib/shop/shield-storage";
import {
  selectRescueModalState,
  type RescueModalVariant,
} from "@/lib/exercises/use-rescue-modal-state";

/**
 * useFailRescue — orchestrates the fail-rescue modal lifecycle.
 *
 * Combines live shield count, Welcome-Pack claimed status, and a
 * dismissal-history counter into the discriminated `variant` the
 * <FailRescueModal /> needs to render. Provides the four CTA
 * handlers wired to:
 *
 *   - onUseShield  → POST /api/shields/spend (server-authoritative)
 *   - onRetryAnyway → bumps ignore counter + calls onSkipped
 *   - onClaimFree  → opens shop focused on welcome-pack
 *   - onGetShields → opens shop focused on shield SKU
 *
 * The caller passes `onRescued` (run AFTER server confirms shield
 * spend — streak intact, board reset) and `onSkipped` (run when the
 * user closes without using a shield — streak loses one star, board
 * reset). Separating those side-effects from the rescue mechanic
 * keeps this hook testable without coupling to board state.
 *
 * Spec: §3.0-§3.7 (rescue flow) + §3.5 (use-shield interaction) +
 * server-endpoint decision confirmed 2026-05-31.
 */

const IGNORE_KEY = "chesscito:rescue_ignores";
const PRIMER_SHOWN_KEY = "chesscito:rescue_primer_shown";

function safeReadInt(key: string): number {
  if (typeof window === "undefined") return 0;
  try {
    const raw = window.localStorage.getItem(key);
    if (raw == null) return 0;
    const n = Number.parseInt(raw, 10);
    if (!Number.isFinite(n) || n < 0) return 0;
    return n;
  } catch {
    return 0;
  }
}

function safeWriteInt(key: string, value: number): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, String(Math.max(0, Math.floor(value))));
  } catch {
    /* ignore */
  }
}

function safeReadBool(key: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

function bumpIgnoreCount(): void {
  safeWriteInt(IGNORE_KEY, safeReadInt(IGNORE_KEY) + 1);
}

function markPrimerShown(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(PRIMER_SHOWN_KEY, "1");
  } catch {
    /* ignore */
  }
}

export type UseFailRescueOptions = {
  /** Side-effect run AFTER the server confirms a successful shield
   *  spend. Caller resets the board and keeps the streak. */
  onRescued: () => void;
  /** Side-effect run when the user DELIBERATELY closes the modal
   *  without using a shield (X tap, Retry anyway, or server reported
   *  409 insufficient because the cache was stale). Caller resets the
   *  board AND decrements the streak — the player chose to abandon
   *  the rescue. */
  onSkipped: () => void;
  /** Side-effect run when the player tried to use a shield but the
   *  server failed with a 5xx / network error. The player INTENDED to
   *  rescue — penalizing the streak here would feel like punishment
   *  for our infra glitch. Caller resets the board but PRESERVES the
   *  streak. Distinct from onSkipped per red-team E11. */
  onServerError: () => void;
  /** Opens the Shop sheet focused on a specific surface. v1 just opens
   *  the sheet; polish pass can wire actual scroll-to-focus via a
   *  query param. */
  onOpenShop: (focus: "welcome-pack" | "shield-sku") => void;
};

export type UseFailRescueReturn = {
  variant: RescueModalVariant;
  shieldsCount: number;
  /** Indicates a server spend is in flight. Caller can disable taps
   *  to prevent double-spend during the 250ms sprite-swap + 400ms
   *  board-fade animation window. */
  isSpending: boolean;
  onUseShield: () => void;
  onRetryAnyway: () => void;
  onClaimFree: () => void;
  onGetShields: () => void;
  /** Called by FailRescueModal when it actually renders variant A (the
   *  primer). Sets a localStorage flag so subsequent rescues with
   *  shields show variant B (compact, no primer). Idempotent. Critical
   *  for E18 fix: the flag is bumped ONLY when A actually shows, not
   *  on every modal mount. */
  markPrimerShown: () => void;
};

export function useFailRescue(
  options: UseFailRescueOptions,
): UseFailRescueReturn {
  const { address } = useAccount();
  const shieldsCount = useShieldsCount();
  const welcomePack = useWelcomePackClaim();
  const [isSpending, setIsSpending] = useState(false);

  // Refs around handlers prevent the useCallback memos below from
  // invalidating every render (caller doesn't have to memoize).
  const optionsRef = useRef(options);
  useEffect(() => {
    optionsRef.current = options;
  });

  // Read the persisted counters on mount and on every consumer render.
  // These are localStorage-backed; no React state needed since the
  // variant selector is recomputed each render.
  const variantState = useMemo(() => {
    return selectRescueModalState({
      shieldsCount,
      welcomePackClaimed: welcomePack.state === "claimed",
      rescuePrimerShown: safeReadBool(PRIMER_SHOWN_KEY),
    });
  }, [shieldsCount, welcomePack.state]);

  const markPrimerShownCb = useCallback(() => {
    markPrimerShown();
  }, []);

  const onUseShield = useCallback(() => {
    if (!address || isSpending) return;
    setIsSpending(true);

    (async () => {
      try {
        const res = await fetch("/api/shields/spend", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ walletAddress: address }),
        });
        const data = (await res.json().catch(() => ({}))) as {
          ok?: boolean;
          spent?: number;
          balance?: number;
          error?: string;
        };

        if (res.ok && data.spent === 1 && typeof data.balance === "number") {
          // Sync the credited cache with the server's new balance.
          // The displayed count is derived as min(MAX, credited -
          // consumed), so adding back the local `consumed` keeps the
          // displayed delta exactly -1.
          writeCreditedCache(data.balance + readConsumedCount());
          dispatchShieldChange();
          optionsRef.current.onRescued();
        } else if (!res.ok && res.status >= 500) {
          // 5xx — server error during a real rescue attempt. The
          // player TRIED to rescue; don't penalize the streak for
          // our infra glitch (red-team E11).
          optionsRef.current.onServerError();
        } else {
          // 409 insufficient or any other 4xx — the player's local
          // state was out of sync with the server, but functionally
          // this is the same outcome as a deliberate skip: no shield
          // was spent, the streak resets.
          optionsRef.current.onSkipped();
        }
      } catch {
        // Network failure — same psychology as 5xx, treat as server
        // error rather than punishing the player (red-team E11).
        optionsRef.current.onServerError();
      } finally {
        setIsSpending(false);
      }
    })();
  }, [address, isSpending]);

  const onRetryAnyway = useCallback(() => {
    bumpIgnoreCount();
    optionsRef.current.onSkipped();
  }, []);

  const onClaimFree = useCallback(() => {
    optionsRef.current.onOpenShop("welcome-pack");
  }, []);

  const onGetShields = useCallback(() => {
    optionsRef.current.onOpenShop("shield-sku");
  }, []);

  return {
    variant: variantState.variant,
    shieldsCount,
    isSpending,
    onUseShield,
    onRetryAnyway,
    onClaimFree,
    onGetShields,
    markPrimerShown: markPrimerShownCb,
  };
}
