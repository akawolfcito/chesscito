"use client";

import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useAccount } from "wagmi";
import { CHESSCITO_LITE_MODE } from "@/lib/feature-flags";
import {
  resolveEffectiveTrainingPass,
  type EffectiveTrainingPass,
} from "@/lib/entitlements/effective-training-pass";

export type SeasonPassStatus = EffectiveTrainingPass & {
  /** Remote authority state. `active` remains the authorization-compatible
   * boolean consumed by existing gates; presentation may retain a prior tier
   * only while this state is loading/error/unknown. */
  state: EffectiveTrainingPassRemoteState;
  loading: boolean;
  error: EffectiveTrainingPassStatusError | null;
  seasonId: string | null;
  supporterStatus: string | null;
  shieldsCredited: number;
};

export type EffectiveTrainingPassRemoteState =
  | "unknown"
  | "loading"
  | "active"
  | "inactive"
  | "error";

export type EffectiveTrainingPassStatusError = {
  kind: "http" | "network" | "invalid-response";
  httpStatus: number | null;
};

export type SeasonPassStatusSnapshot = SeasonPassStatus & {
  walletKey: string | null;
  refresh: () => Promise<void>;
};

const INITIAL: SeasonPassStatus = {
  state: "loading",
  active: false,
  source: null,
  seasonPassExpiresAt: null,
  proExpiresAt: null,
  loading: true,
  error: null,
  seasonId: null,
  supporterStatus: null,
  shieldsCredited: 0,
};

const EffectiveTrainingPassContext =
  createContext<SeasonPassStatusSnapshot | null>(null);

function isValidIsoDate(value: unknown): value is string {
  return typeof value === "string" && Number.isFinite(new Date(value).getTime());
}

function isSeasonPassStatusPayload(
  value: unknown,
): value is Record<string, unknown> & { active: boolean } {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const body = value as Record<string, unknown>;
  if (typeof body.active !== "boolean") return false;
  if (
    body.source !== null &&
    body.source !== "pro" &&
    body.source !== "season_pass"
  ) {
    return false;
  }
  if (body.active && body.source === null) return false;
  if (!body.active && body.source !== null) return false;
  if (
    body.seasonPassExpiresAt !== undefined &&
    body.seasonPassExpiresAt !== null &&
    !isValidIsoDate(body.seasonPassExpiresAt)
  ) {
    return false;
  }
  if (
    body.proExpiresAt !== undefined &&
    body.proExpiresAt !== null &&
    (typeof body.proExpiresAt !== "number" || !Number.isFinite(body.proExpiresAt))
  ) {
    return false;
  }
  if (
    body.active &&
    body.source === "season_pass" &&
    !isValidIsoDate(body.seasonPassExpiresAt)
  ) {
    return false;
  }
  if (
    body.active &&
    body.source === "pro" &&
    (typeof body.proExpiresAt !== "number" || !Number.isFinite(body.proExpiresAt))
  ) {
    return false;
  }
  if (
    body.shieldsCredited !== undefined &&
    (typeof body.shieldsCredited !== "number" ||
      !Number.isInteger(body.shieldsCredited) ||
      body.shieldsCredited < 0)
  ) {
    return false;
  }
  return true;
}

function useSeasonPassStatusSource(
  wallet: string | undefined,
  enabled = true,
): SeasonPassStatusSnapshot {
  const [status, setStatus] = useState<SeasonPassStatus>(INITIAL);
  const [statusWallet, setStatusWallet] = useState<string | undefined>();
  const abortRef = useRef<AbortController | null>(null);
  const walletKey = wallet?.toLowerCase();

  const refresh = useCallback(async () => {
    if (!enabled) return;
    if (!CHESSCITO_LITE_MODE || !wallet) {
      setStatusWallet(undefined);
      setStatus({
        ...INITIAL,
        state: "unknown",
        loading: false,
      });
      return;
    }
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setStatusWallet(wallet.toLowerCase());
    setStatus({ ...INITIAL, state: "loading", loading: true });
    try {
      const res = await fetch(`/api/season-pass/status?wallet=${wallet}`, {
        signal: ctrl.signal,
      });
      if (ctrl.signal.aborted || abortRef.current !== ctrl) return;
      if (!res.ok) {
        setStatus({
          ...INITIAL,
          state: "error",
          loading: false,
          error: { kind: "http", httpStatus: res.status },
        });
        return;
      }
      let body: unknown;
      try {
        body = await res.json();
      } catch {
        if (ctrl.signal.aborted || abortRef.current !== ctrl) return;
        setStatus({
          ...INITIAL,
          state: "unknown",
          loading: false,
          error: { kind: "invalid-response", httpStatus: res.status },
        });
        return;
      }
      if (ctrl.signal.aborted || abortRef.current !== ctrl) return;
      if (!isSeasonPassStatusPayload(body)) {
        setStatus({
          ...INITIAL,
          state: "unknown",
          loading: false,
          error: { kind: "invalid-response", httpStatus: res.status },
        });
        return;
      }
      const json = body;
      const source =
        json.source === "pro" || json.source === "season_pass"
          ? json.source
          : null;
      const seasonPassExpiresAt =
        typeof json.seasonPassExpiresAt === "string"
          ? json.seasonPassExpiresAt
          : null;
      const effective = resolveEffectiveTrainingPass({
        seasonPass: {
          active: json.active === true && source === "season_pass",
          expiresAt: seasonPassExpiresAt,
        },
        pro: {
          active: json.active === true && source === "pro",
          expiresAt:
            typeof json.proExpiresAt === "number" ? json.proExpiresAt : null,
        },
      });
      setStatus({
        ...effective,
        state: effective.active ? "active" : "inactive",
        loading: false,
        error: null,
        seasonId: typeof json.seasonId === "string" ? json.seasonId : null,
        supporterStatus:
          typeof json.supporterStatus === "string"
            ? json.supporterStatus
            : null,
        shieldsCredited:
          typeof json.shieldsCredited === "number"
            ? json.shieldsCredited
            : 0,
      });
    } catch (e) {
      if ((e as Error)?.name === "AbortError") return;
      if (ctrl.signal.aborted || abortRef.current !== ctrl) return;
      setStatus({
        ...INITIAL,
        state: "unknown",
        loading: false,
        error: { kind: "network", httpStatus: null },
      });
    }
  }, [enabled, wallet]);

  useEffect(() => {
    if (enabled) void refresh();
    return () => abortRef.current?.abort();
  }, [enabled, refresh]);

  // Re-resolve at the effective source's expiry while the page stays open.
  // The server remains authoritative and can fall back from PRO to a still-
  // active direct pass. `loading` is not denial, so an already-mounted premium
  // attempt keeps its attempt grant while this refresh is in flight.
  useEffect(() => {
    if (!enabled || status.loading || !status.active || status.source === null) return;
    const expiry =
      status.source === "pro"
        ? status.proExpiresAt
        : status.seasonPassExpiresAt
          ? new Date(status.seasonPassExpiresAt).getTime()
          : null;
    if (expiry === null || !Number.isFinite(expiry)) return;
    const delay = Math.min(
      Math.max(expiry - Date.now() + 50, 50),
      2_147_000_000,
    );
    const timer = window.setTimeout(() => void refresh(), delay);
    return () => window.clearTimeout(timer);
  }, [
    enabled,
    refresh,
    status.active,
    status.loading,
    status.proExpiresAt,
    status.seasonPassExpiresAt,
    status.source,
  ]);

  // Wallet changes are an authorization boundary. Before the effect starts the
  // new request, never expose the previous wallet's resolved entitlement.
  const visibleStatus = statusWallet === walletKey
    ? status
    : { ...INITIAL, loading: true };

  return { ...visibleStatus, walletKey: walletKey ?? null, refresh };
}

/** One wallet-scoped effective Training Pass snapshot for the entire localized
 * app. Descendant calls to `useSeasonPassStatus` reuse this value, so a
 * post-purchase refresh updates gates, commercial copy and the visual tier in
 * the same render without duplicate requests. */
export function EffectiveTrainingPassProvider({
  children,
}: {
  children: ReactNode;
}) {
  const { address } = useAccount();
  const status = useSeasonPassStatusSource(address);
  return createElement(
    EffectiveTrainingPassContext.Provider,
    { value: status },
    children,
  );
}

/** Existing consumer contract, now context-aware. Outside the app provider
 * (unit tests and isolated probes), it retains its standalone behavior. */
export function useSeasonPassStatus(wallet: string | undefined) {
  const shared = useContext(EffectiveTrainingPassContext);
  const walletKey = wallet?.toLowerCase() ?? null;
  const sharesProviderWallet = shared?.walletKey === walletKey;
  const local = useSeasonPassStatusSource(wallet, !sharesProviderWallet);
  return sharesProviderWallet && shared ? shared : local;
}
