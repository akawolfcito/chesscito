"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAccount, useSignMessage } from "wagmi";
import { useConnectModal } from "@rainbow-me/rainbowkit";

import { dispatchShieldChange } from "@/lib/shop/shield-events";
import type { WelcomePackTileState } from "@/components/exercises/welcome-pack-tile";

/**
 * useWelcomePackClaim — Welcome Pack state + claim orchestration.
 *
 * Spec: _bmad-output/planning-artifacts/ux-shield-rescue-and-welcome-
 * pack-2026-05-31.md §4.2 (claim mechanic) + §5.3 (signature flow).
 *
 * Responsibilities:
 *   - Read `claimed_at` from /api/welcome-pack/status with a 24h
 *     localStorage cache (mirrors useFounderStatus pattern — once
 *     claimed, the flag never flips back, so aggressive caching is
 *     safe and avoids a cold-load network round trip).
 *   - Build the canonical signed message, ask wagmi to sign it via
 *     useSignMessage, POST /api/welcome-pack/claim.
 *   - Map wallet/connect/in-flight/claimed states onto the
 *     WelcomePackTileState discriminator the tile consumes.
 *   - Dispatch shield-events so the HUD chip refreshes the new count
 *     without a reload (same channel as paid shield purchases).
 *
 * Returns a value shaped to drop directly into
 * `<ShopSheet welcomePack={...} />`.
 */

const STORAGE_PREFIX = "chesscito:welcome-pack:";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

type CachedStatus = {
  claimed: boolean;
  claimedAt: string | null;
  ts: number;
};

function storageKey(wallet: string): string {
  return `${STORAGE_PREFIX}${wallet.toLowerCase()}`;
}

function readCache(wallet: string | undefined): CachedStatus | null {
  if (typeof window === "undefined" || !wallet) return null;
  try {
    const raw = window.localStorage.getItem(storageKey(wallet));
    if (!raw) return null;
    const entry = JSON.parse(raw) as CachedStatus;
    if (Date.now() - entry.ts > CACHE_TTL_MS) return null;
    return entry;
  } catch {
    return null;
  }
}

function writeCache(wallet: string, claimed: boolean, claimedAt: string | null): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      storageKey(wallet),
      JSON.stringify({ claimed, claimedAt, ts: Date.now() }),
    );
  } catch {
    /* storage unavailable — ignore */
  }
}

function buildCanonicalMessage(address: string, isoTimestamp: string): string {
  // Mirrors lib/server/welcome-pack.ts buildClaimMessage. Must stay in
  // sync with the server-side regex MESSAGE_RE.
  return `Chesscito Welcome Pack — claim for ${address} at ${isoTimestamp}`;
}

export type UseWelcomePackClaimOptions = {
  /** Fired ONCE after the server confirms a fresh claim (not on
   *  `already_claimed`). Lets the caller stage a post-claim flow
   *  like auto-closing the Shop sheet so the player isn't trapped
   *  on the catalog when they came from a deep link. Per spec
   *  section 4 forcing-function review (user feedback 2026-05-31). */
  onClaimedFresh?: () => void;
};

export type UseWelcomePackClaimReturn = {
  state: WelcomePackTileState;
  claimedAt: string | null;
  onClaim: () => void;
  onConnect: () => void;
};

export function useWelcomePackClaim(
  options?: UseWelcomePackClaimOptions,
): UseWelcomePackClaimReturn {
  const { address, isConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const { openConnectModal } = useConnectModal();
  const walletLower = address?.toLowerCase();

  const initialCache = readCache(walletLower);
  const [claimed, setClaimed] = useState<boolean>(initialCache?.claimed ?? false);
  const [claimedAt, setClaimedAt] = useState<string | null>(
    initialCache?.claimedAt ?? null,
  );
  const [inFlight, setInFlight] = useState(false);

  const isMountedRef = useRef(true);
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Capture onClaimedFresh in a ref so the claim callback closure
  // below doesn't have to depend on it (avoids re-creating the
  // useCallback on every parent render).
  const onClaimedFreshRef = useRef(options?.onClaimedFresh);
  useEffect(() => {
    onClaimedFreshRef.current = options?.onClaimedFresh;
  });

  // Re-seed from cache when the active wallet changes, then refresh from
  // the server. Mirror of useFounderStatus — once claimed never reverts,
  // so cache is the source of optimistic truth.
  useEffect(() => {
    if (!walletLower) {
      setClaimed(false);
      setClaimedAt(null);
      return;
    }
    const cached = readCache(walletLower);
    setClaimed(cached?.claimed ?? false);
    setClaimedAt(cached?.claimedAt ?? null);

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/welcome-pack/status?wallet=${walletLower}`,
        );
        if (!res.ok) return;
        const data = (await res.json()) as {
          ok?: boolean;
          claimed?: boolean;
          claimed_at?: string | null;
        };
        if (cancelled || !isMountedRef.current) return;
        const nextClaimed = data.claimed === true;
        setClaimed(nextClaimed);
        setClaimedAt(data.claimed_at ?? null);
        writeCache(walletLower, nextClaimed, data.claimed_at ?? null);
      } catch {
        // Keep whatever cache returned. Status is non-critical for
        // first paint; user can still tap Claim and the server will
        // resolve idempotently.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [walletLower]);

  const onConnect = useCallback(() => {
    if (openConnectModal) openConnectModal();
  }, [openConnectModal]);

  const onClaim = useCallback(() => {
    if (!address || !walletLower || claimed || inFlight) return;
    setInFlight(true);

    (async () => {
      try {
        const isoTimestamp = new Date().toISOString();
        const message = buildCanonicalMessage(address, isoTimestamp);
        const signature = await signMessageAsync({ message });

        const res = await fetch("/api/welcome-pack/claim", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ address, signature, message }),
        });
        const payload = (await res.json().catch(() => ({}))) as {
          ok?: boolean;
          claimed?: boolean;
          already_claimed?: boolean;
          claimed_at?: string | null;
          shields_granted?: number;
          credited?: number;
          error?: string;
        };

        if (!isMountedRef.current) return;

        if (res.ok && (payload.claimed || payload.already_claimed)) {
          const at = payload.claimed_at ?? new Date().toISOString();
          setClaimed(true);
          setClaimedAt(at);
          writeCache(walletLower, true, at);
          // Notify HUD chip + Account inventory row of new balance.
          // Only fire on fresh claim — already_claimed should NOT
          // create a phantom shield delta in the UI.
          if (payload.claimed && typeof payload.credited === "number") {
            dispatchShieldChange();
            // Fire post-fresh-claim callback (e.g. auto-close Shop
            // sheet so the player returns to the exercises arena).
            // Only on fresh claim — already_claimed should NOT
            // trigger a redundant celebration close.
            onClaimedFreshRef.current?.();
          }
        }
        // Non-ok responses are surfaced via the tile reverting to its
        // pre-claim state when inFlight clears. v1 ships without a
        // toast renderer here; commit 10's polish pass adds one.
      } catch {
        // signMessage rejected by the user OR network failure → just
        // re-enable the button. No state change.
      } finally {
        if (isMountedRef.current) setInFlight(false);
      }
    })();
  }, [address, walletLower, claimed, inFlight, signMessageAsync]);

  let state: WelcomePackTileState;
  if (claimed) state = "claimed";
  else if (inFlight) state = "claiming";
  else if (!isConnected || !address) state = "connect";
  else state = "idle";

  return { state, claimedAt, onClaim, onConnect };
}
