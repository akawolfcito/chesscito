"use client";

import { useEffect } from "react";
import { useAccount } from "wagmi";

import {
  useProStatus,
  type ProRemoteState,
  type ProStatus,
  type ProStatusError,
} from "@/lib/pro/use-pro-status";
import { daysRemaining } from "@/lib/pro/days-remaining";

const STORAGE_PREFIX = "chesscito:pro-active:";

function storageKey(wallet: string): string {
  return `${STORAGE_PREFIX}${wallet.toLowerCase()}`;
}

type CachedProEntitlement = {
  active: boolean;
  expiresAt: number | null;
};

function readCachedEntitlement(wallet: string | undefined): CachedProEntitlement {
  if (typeof window === "undefined" || !wallet) {
    return { active: false, expiresAt: null };
  }
  try {
    const stored = window.localStorage.getItem(storageKey(wallet));
    if (stored === "1") return { active: true, expiresAt: null };
    const expiresAt = stored === null ? Number.NaN : Number(stored);
    return Number.isFinite(expiresAt) && expiresAt > Date.now()
      ? { active: true, expiresAt }
      : { active: false, expiresAt: null };
  } catch {
    return { active: false, expiresAt: null };
  }
}

export type StaleProEntitlement = {
  source: "local-cache" | "server";
  active: boolean;
  expiresAt: number | null;
};

export type ProEntitlementState = {
  status: ProRemoteState;
  /** Authorization for a NEW PRO action. True only from a current successful
   * server response; stale server/local data can never set this flag. */
  active: boolean;
  loading: boolean;
  expiresAt: number | null;
  stale: StaleProEntitlement | null;
  error: ProStatusError | null;
};

export type ProDisplayState =
  | { status?: "active"; active: true; daysRemaining: number }
  | { status?: "inactive"; active: false }
  | {
      status: "loading" | "error" | "unknown";
      active: false;
      staleVisualActive: boolean;
    };

/** Maps the effective entitlement to the shared Hub presentation contract. */
export function proDisplayState(
  entitlement: ProEntitlementState,
  now = Date.now(),
): ProDisplayState {
  if (entitlement.status === "active" && entitlement.active) {
    return {
      status: "active",
      active: true,
      daysRemaining: daysRemaining(entitlement.expiresAt, now) ?? 1,
    };
  }
  if (entitlement.status === "inactive") {
    return { status: "inactive", active: false };
  }
  return {
    status:
      entitlement.status === "active" ? "unknown" : entitlement.status,
    active: false,
    staleVisualActive:
      entitlement.stale?.source === "server" &&
      entitlement.stale.active === true,
  };
}

function staleServerEntitlement(status: ProStatus | null): StaleProEntitlement | null {
  if (!status) return null;
  return {
    source: "server",
    active:
      status.active &&
      status.expiresAt !== null &&
      status.expiresAt > Date.now(),
    expiresAt: status.expiresAt,
  };
}

/**
 * Boolean flag for "is the connected wallet currently a PRO subscriber?"
 *
 * Wraps `useProStatus(address)` with three conveniences any UI layer
 * gating itself on PRO needs:
 *
 *  1. Single-import contract — `const isPro = useIsProActive()` returns
 *     just the boolean. Consumers don't have to repeat the
 *     `status?.active && expiresAt > Date.now()` shape on every callsite.
 *
 *  2. Live expiry check — the API can report `active: true` with an
 *     already-past `expiresAt` if the user opened the app the moment
 *     their pass lapsed. Re-check against `Date.now()` so the UI flips
 *     to inactive without waiting for the server cache to invalidate.
 *
 *  3. localStorage cache to suppress the "no PRO" flash on every
 *     mount. The fetch resolves async; before it does, the UI would
 *     paint the inactive variant for ~200ms then swap to the PRO
 *     variant, which looks like an unwanted flicker for paying users.
 *     The cache reads the last known active state synchronously on
 *     first render so PRO users see the right variant immediately.
 *     The fetch still runs and overrides the cached value if it
 *     disagrees — the cache is an opening guess, not the source of truth.
 *
 * No wallet connected → returns `false` (no claim to PRO state exists).
 */
export function useProEntitlement(): ProEntitlementState {
  const { address } = useAccount();
  const wallet = address?.toLowerCase();
  const remote = useProStatus(wallet);
  const { status } = remote;

  // MiniPay injects and connects its wallet after the provider mounts. Read
  // the cache for the CURRENT wallet on every render instead of capturing the
  // pre-connect `undefined` wallet in a one-shot state initializer.
  const cached = readCachedEntitlement(wallet);

  // Compute the server-truth value with the live expiry check baked in.
  const serverActive =
    status?.active === true &&
    status.expiresAt !== null &&
    status.expiresAt > Date.now();

  // Write-through to localStorage whenever the server result changes.
  // Skips when `status === null` (still loading / no wallet) so the
  // cache survives transient null states between wallet swaps.
  useEffect(() => {
    if (!wallet || status === null) return;
    try {
      if (serverActive) {
        window.localStorage.setItem(storageKey(wallet), String(status.expiresAt));
      } else {
        window.localStorage.removeItem(storageKey(wallet));
      }
    } catch {
      // Quota-exceeded / disabled storage — fall through; the in-memory
      // `serverActive` value still drives the current render.
    }
  }, [wallet, status, serverActive]);

  // Server answer wins once it lands. Cache only matters during the
  // brief window before the first fetch resolves.
  if (!wallet) {
    return {
      status: "unknown",
      active: false,
      loading: false,
      expiresAt: null,
      stale: null,
      error: null,
    };
  }

  if (remote.state === "loading") {
    return {
      status: "loading",
      active: false,
      loading: true,
      expiresAt: null,
      stale: cached.active
        ? { source: "local-cache", active: true, expiresAt: cached.expiresAt }
        : null,
      error: null,
    };
  }

  if (remote.state === "error" || remote.state === "unknown") {
    return {
      status: remote.state,
      active: false,
      loading: false,
      expiresAt: null,
      stale:
        staleServerEntitlement(remote.staleStatus) ??
        (cached.active
          ? { source: "local-cache", active: true, expiresAt: cached.expiresAt }
          : null),
      error: remote.error,
    };
  }

  if (serverActive && status.expiresAt !== null) {
    return {
      status: "active",
      active: true,
      loading: false,
      expiresAt: status.expiresAt,
      stale: null,
      error: null,
    };
  }

  return {
    status: "inactive",
    active: false,
    loading: false,
    expiresAt: null,
    stale: null,
    error: null,
  };
}

export function useIsProActive(): boolean {
  return useProEntitlement().active;
}
