"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CHESSCITO_LITE_MODE } from "@/lib/feature-flags";

export type SeasonPassStatus =
  | { active: false; loading: boolean }
  | { active: true; loading: boolean; expiresAt: string; seasonId: string; supporterStatus: string; shieldsCredited: number };

const INITIAL: SeasonPassStatus = { active: false, loading: true };

export function useSeasonPassStatus(wallet: string | undefined) {
  const [status, setStatus] = useState<SeasonPassStatus>(INITIAL);
  const abortRef = useRef<AbortController | null>(null);

  const refresh = useCallback(async () => {
    if (!CHESSCITO_LITE_MODE || !wallet) {
      setStatus({ active: false, loading: false });
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
      if (json.active) {
        setStatus({
          active: true,
          loading: false,
          expiresAt: json.expiresAt,
          seasonId: json.seasonId,
          supporterStatus: json.supporterStatus ?? "challenger",
          shieldsCredited: json.shieldsCredited ?? 3,
        });
      } else {
        setStatus({ active: false, loading: false });
      }
    } catch (e) {
      if ((e as Error)?.name === "AbortError") return;
      setStatus({ active: false, loading: false });
    }
  }, [wallet]);

  useEffect(() => {
    void refresh();
    return () => abortRef.current?.abort();
  }, [refresh]);

  return { ...status, refresh };
}
