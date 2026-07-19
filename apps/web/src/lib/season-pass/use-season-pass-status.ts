"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CHESSCITO_LITE_MODE } from "@/lib/feature-flags";
import {
  resolveEffectiveTrainingPass,
  type EffectiveTrainingPass,
} from "@/lib/entitlements/effective-training-pass";

export type SeasonPassStatus = EffectiveTrainingPass & {
  loading: boolean;
  seasonId: string | null;
  supporterStatus: string | null;
  shieldsCredited: number;
};

const INITIAL: SeasonPassStatus = {
  active: false,
  source: null,
  seasonPassExpiresAt: null,
  proExpiresAt: null,
  loading: true,
  seasonId: null,
  supporterStatus: null,
  shieldsCredited: 0,
};

export function useSeasonPassStatus(wallet: string | undefined) {
  const [status, setStatus] = useState<SeasonPassStatus>(INITIAL);
  const [statusWallet, setStatusWallet] = useState<string | undefined>();
  const abortRef = useRef<AbortController | null>(null);
  const walletKey = wallet?.toLowerCase();

  const refresh = useCallback(async () => {
    if (!CHESSCITO_LITE_MODE || !wallet) {
      setStatusWallet(undefined);
      setStatus({ ...INITIAL, loading: false });
      return;
    }
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setStatusWallet(wallet.toLowerCase());
    setStatus({ ...INITIAL, loading: true });
    try {
      const res = await fetch(`/api/season-pass/status?wallet=${wallet}`, {
        signal: ctrl.signal,
      });
      if (!res.ok) throw new Error(`status ${res.status}`);
      const json = await res.json();
      if (ctrl.signal.aborted || abortRef.current !== ctrl) return;
      const source =
        json.source === "pro" || json.source === "season_pass"
          ? json.source
          : null;
      const effective = resolveEffectiveTrainingPass({
        seasonPass: {
          active: json.active === true && source === "season_pass",
          expiresAt: json.seasonPassExpiresAt ?? null,
        },
        pro: {
          active: json.active === true && source === "pro",
          expiresAt:
            typeof json.proExpiresAt === "number" ? json.proExpiresAt : null,
        },
      });
      setStatus({
        ...effective,
        loading: false,
        seasonId: json.seasonId ?? null,
        supporterStatus: json.supporterStatus ?? null,
        shieldsCredited: Number(json.shieldsCredited ?? 0),
      });
    } catch (e) {
      if ((e as Error)?.name === "AbortError") return;
      setStatus({ ...INITIAL, loading: false });
    }
  }, [wallet]);

  useEffect(() => {
    void refresh();
    return () => abortRef.current?.abort();
  }, [refresh]);

  // Re-resolve at the effective source's expiry while the page stays open.
  // The server remains authoritative and can fall back from PRO to a still-
  // active direct pass. `loading` is not denial, so an already-mounted premium
  // attempt keeps its attempt grant while this refresh is in flight.
  useEffect(() => {
    if (status.loading || !status.active || status.source === null) return;
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

  return { ...visibleStatus, refresh };
}
