"use client";

import { useEffect, useRef, useState } from "react";
import { useChainId, usePublicClient } from "wagmi";
import { badgesAbi } from "@/lib/contracts/badges";
import { getBadgesAddress } from "@/lib/contracts/chains";
import { readDisplayedShields } from "@/lib/shop/shield-storage";

/**
 * 4-OR wallet-progress signal that decides whether the WelcomeOverlay
 * carousel mounts. Sources:
 *   - PRO active (server: `/api/pro/status`)
 *   - Any piece badge (chain: `Badges.balanceOf`)
 *   - Any retry shield (localStorage: `readDisplayedShields`)
 *   - Founder Badge purchase (server: `/api/founder-status` — event scan)
 *
 * The first positive signal commits "returning" early (no need to wait
 * for the rest). All-negative → "fresh". 2000ms total budget; on
 * timeout, fall back to "fresh" (safer to over-show the carousel than
 * to leave a real fresh user stranded).
 *
 * Result cached to `chesscito:onboarding-signal:{walletLower}` for 7
 * days. Subsequent visits within the TTL bypass the network entirely
 * and return synchronously, so returning users see zero carousel
 * friction even on cold MiniPay-Vercel cold starts.
 *
 * Per addendum §0.2 + §0.3.
 */

export type OnboardingSignalStatus = "resolving" | "fresh" | "returning";
export type OnboardingSignalSource =
  | "pro"
  | "badge"
  | "shield"
  | "founder"
  | "fallback"
  | null;

export type OnboardingSignalResult = {
  status: OnboardingSignalStatus;
  signal: OnboardingSignalSource;
};

const CACHE_KEY_PREFIX = "chesscito:onboarding-signal:";
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const TOTAL_BUDGET_MS = 2000;

type CachedSignal = {
  status: "fresh" | "returning";
  signal: OnboardingSignalSource;
  cachedAt: number;
};

function readCache(walletLower: string): CachedSignal | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(`${CACHE_KEY_PREFIX}${walletLower}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedSignal;
    if (
      typeof parsed.cachedAt !== "number" ||
      Date.now() - parsed.cachedAt > CACHE_TTL_MS
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function writeCache(walletLower: string, value: CachedSignal) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(
      `${CACHE_KEY_PREFIX}${walletLower}`,
      JSON.stringify(value),
    );
  } catch {
    /* best-effort */
  }
}

export function useOnboardingSignal(
  walletAddress: `0x${string}` | undefined,
): OnboardingSignalResult {
  const chainId = useChainId();
  const publicClient = usePublicClient({ chainId });
  // wagmi may return a new publicClient object identity on every render
  // (especially under StrictMode / hot-reload). Capture in a ref so the
  // signal effect doesn't restart on each render and create a runaway
  // timeout loop. The chainId is the meaningful trigger for re-resolve.
  const publicClientRef = useRef(publicClient);
  publicClientRef.current = publicClient;

  const [result, setResult] = useState<OnboardingSignalResult>({
    status: "resolving",
    signal: null,
  });

  useEffect(() => {
    let cancelled = false;

    // No wallet → fresh (anonymous users see the carousel).
    if (!walletAddress) {
      setResult({ status: "fresh", signal: null });
      return () => {
        cancelled = true;
      };
    }

    const walletLower = walletAddress.toLowerCase();

    // Cache hit short-circuits to a synchronous returning/fresh.
    const cached = readCache(walletLower);
    if (cached) {
      setResult({ status: cached.status, signal: cached.signal });
      return () => {
        cancelled = true;
      };
    }

    setResult({ status: "resolving", signal: null });

    let committed = false;
    function commit(
      source: OnboardingSignalSource,
      status: "fresh" | "returning",
    ) {
      if (committed || cancelled) return;
      committed = true;
      const next: OnboardingSignalResult = { status, signal: source };
      writeCache(walletLower, { status, signal: source, cachedAt: Date.now() });
      setResult(next);
    }

    // Shield is localStorage-sync — check first; if positive, commit
    // immediately and skip the other reads entirely (cheapest signal).
    if (readDisplayedShields() > 0) {
      commit("shield", "returning");
      return () => {
        cancelled = true;
      };
    }

    const proPromise: Promise<"pro" | null> = fetch(
      `/api/pro/status?wallet=${walletLower}`,
    )
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { active?: boolean } | null) =>
        d?.active === true ? ("pro" as const) : null,
      )
      .catch(() => null);

    const founderPromise: Promise<"founder" | null> = fetch(
      `/api/founder-status?wallet=${walletLower}`,
    )
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { ownsFounder?: boolean } | null) =>
        d?.ownsFounder === true ? ("founder" as const) : null,
      )
      .catch(() => null);

    // Badges contract uses `hasClaimedBadge(player, levelId)` (no
    // balanceOf). Rook = levelId 1 = first claimable piece in the
    // progression; any returning user with ANY badge must have rook
    // first (the contract enforces sequential level claims). So this
    // single read is sufficient for the "any badge" signal.
    const badgesAddress = getBadgesAddress(chainId);
    const client = publicClientRef.current;
    const badgePromise: Promise<"badge" | null> =
      client && badgesAddress
        ? client
            .readContract({
              address: badgesAddress,
              abi: badgesAbi,
              functionName: "hasClaimedBadge",
              args: [walletAddress, 1n],
            })
            .then((claimed) =>
              claimed === true ? ("badge" as const) : null,
            )
            .catch(() => null)
        : Promise.resolve(null);

    // Commit-early race: any positive signal wins immediately.
    void proPromise.then((s) => s && commit(s, "returning"));
    void founderPromise.then((s) => s && commit(s, "returning"));
    void badgePromise.then((s) => s && commit(s, "returning"));

    // All-negative → fresh path resolves the cycle.
    void Promise.all([proPromise, founderPromise, badgePromise]).then(
      ([pro, founder, badge]) => {
        if (committed || cancelled) return;
        const positive = pro ?? founder ?? badge;
        if (positive) {
          commit(positive, "returning");
        } else {
          commit(null, "fresh");
        }
      },
    );

    // 2000ms safety net — degrade to fresh if reads stall.
    const timeoutId = window.setTimeout(() => {
      commit("fallback", "fresh");
    }, TOTAL_BUDGET_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
    // publicClient intentionally omitted — captured via ref above so a
    // new client identity per render does not restart this effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [walletAddress, chainId]);

  return result;
}
