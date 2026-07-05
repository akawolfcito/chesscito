"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CHESSCITO_LITE_MODE } from "@/lib/feature-flags";
import type { EffectiveTrainingPass } from "@/lib/entitlements/effective-training-pass";

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
  const abortRef = useRef<AbortController | null>(null);

  const refresh = useCallback(async () => {
    if (!CHESSCITO_LITE_MODE || !wallet) {
      setStatus({ ...INITIAL, loading: false });
      return;
    }
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setStatus((s) => ({ ...s, loading: true }));
    try {
      const res = await fetch(`/api/season-pass/status?wallet=${wallet}`, {
        signal: ctrl.signal,
      });
      if (!res.ok) throw new Error(`status ${res.status}`);
      const json = await res.json();
      setStatus({
        active: Boolean(json.active),
        source: json.source === "pro" || json.source === "season_pass" ? json.source : null,
        seasonPassExpiresAt: json.seasonPassExpiresAt ?? null,
        proExpiresAt: typeof json.proExpiresAt === "number" ? json.proExpiresAt : null,
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

  return { ...status, refresh };
}
