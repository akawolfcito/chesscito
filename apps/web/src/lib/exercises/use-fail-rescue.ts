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
const SEEN_KEY = "chesscito:rescue_seen";

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

function bumpIgnoreCount(): void {
  safeWriteInt(IGNORE_KEY, safeReadInt(IGNORE_KEY) + 1);
}

function bumpSeenCount(): void {
  safeWriteInt(SEEN_KEY, safeReadInt(SEEN_KEY) + 1);
}

export type UseFailRescueOptions = {
  /** Side-effect run AFTER the server confirms a successful shield
   *  spend. Caller resets the board and keeps the streak. */
  onRescued: () => void;
  /** Side-effect run when the user closes the modal without using a
   *  shield (X tap, Retry anyway, or server reported insufficient).
   *  Caller resets the board and decrements the streak. */
  onSkipped: () => void;
  /** Opens the Shop sheet focused on a specific surface. v1 just opens
   *  the sheet; commit 10 polish pass can wire actual scroll-to-focus
   *  via a query param. */
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
  /** Called by the caller once when the modal first becomes visible
   *  for a given failure, so the seen-count primer-suppression
   *  invariant tracks correctly (variant B once user has seen
   *  variant A). Idempotent — safe to call repeatedly per failure. */
  markSeen: () => void;
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
      rescueSeenCount: safeReadInt(SEEN_KEY),
    });
  }, [shieldsCount, welcomePack.state]);

  const markSeen = useCallback(() => {
    bumpSeenCount();
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
        } else {
          // 409 insufficient (race with another tab) or 5xx: treat
          // as skip so the user isn't trapped. The HUD chip will
          // re-fetch on the next useShieldsCount tick.
          optionsRef.current.onSkipped();
        }
      } catch {
        // Network failure. Same fallback as 5xx.
        optionsRef.current.onSkipped();
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
    markSeen,
  };
}
