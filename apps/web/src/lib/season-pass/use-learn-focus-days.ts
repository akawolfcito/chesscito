"use client";

import { useEffect, useRef, useState } from "react";

import { CHESSCITO_LITE_MODE } from "@/lib/feature-flags";
import type { FocusDaysSlice } from "@/lib/season-pass/focus-days";

/** Local Daily progress with hydration modeled EXPLICITLY.
 *
 *  A bare `null` cannot tell "this player has no history" apart from "we have
 *  not read localStorage yet", and that difference is durable: the server
 *  latches the backfill on a literal `streak=0` and ignores an absent one
 *  (`focus-ledger-init.ts:40,50`). Collapsing the two would freeze a real
 *  player at zero for the season, recoverable only by deleting their
 *  `focus_ledger_init` row. */
export type DailyProgressState =
  | { status: "loading" }
  | {
      status: "ready";
      value: { streak: number; lastCompletedDate: string | null };
    };

/** `idle` means no request was made and none is owed — not LEARN, no wallet,
 *  no entitlement, or progress still hydrating. It is never a zero. */
export type LearnFocusDaysState =
  | { status: "idle" }
  | { status: "loading" }
  | FocusDaysSlice;

const IDLE = { status: "idle" } as const;
const UNAVAILABLE = { status: "unavailable" } as const;

/** The ledger may only report what the server actually sent. Anything we
 *  cannot recognise is OUR failure to read it, never a progress of zero. */
function isFocusDaysSlice(value: unknown): value is FocusDaysSlice {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const slice = value as Record<string, unknown>;
  if (slice.status === "disabled" || slice.status === "unavailable") return true;
  return (
    slice.status === "ok" &&
    Number.isInteger(slice.completed) &&
    Number.isInteger(slice.goal) &&
    typeof slice.seasonId === "string"
  );
}

/** LEARN's Focus Days read. Deliberately NOT part of
 *  `EffectiveTrainingPassProvider` (founder, 2026-07-27): that provider is the
 *  single authority on paid access and must not wait on — or re-fire for — the
 *  Daily's localStorage. This hook only ever reports progress; it never reads
 *  `active`/`source` off the response, so it cannot become a second opinion on
 *  entitlement. A failure here degrades the card and leaves access untouched. */
export function useLearnFocusDays({
  wallet,
  entitlementActive,
  dailyProgress,
  refreshToken = 0,
}: {
  wallet: string | undefined;
  entitlementActive: boolean;
  dailyProgress: DailyProgressState;
  /** Bumped by the recorder once the server confirms a write. Without it the
   *  count only moves on the next mount: the write and this read are separate
   *  calls, and the write lands second. */
  refreshToken?: number;
}): LearnFocusDaysState {
  const [state, setState] = useState<LearnFocusDaysState>(IDLE);
  const abortRef = useRef<AbortController | null>(null);

  // Destructured to primitives so the effect re-runs on the VALUES, not on a
  // fresh object identity every render.
  const hydrated = dailyProgress.status === "ready";
  const streak = dailyProgress.status === "ready" ? dailyProgress.value.streak : null;
  const lastCompletedDate =
    dailyProgress.status === "ready" ? dailyProgress.value.lastCompletedDate : null;

  useEffect(() => {
    // No request is owed. Reporting `idle` (not zero) is what keeps a
    // pre-hydration render from latching the backfill.
    if (!CHESSCITO_LITE_MODE || !wallet || !entitlementActive || !hydrated || streak === null) {
      setState(IDLE);
      return;
    }

    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setState({ status: "loading" });

    // `streak` is always written, including "0" — that literal zero is the
    // claim "no history", and dropping it would silently disable the backfill.
    const params = new URLSearchParams({ wallet, streak: String(streak) });
    if (lastCompletedDate) params.set("lastCompletedDate", lastCompletedDate);

    void (async () => {
      try {
        const res = await fetch(`/api/season-pass/status?${params.toString()}`, {
          signal: ctrl.signal,
        });
        if (ctrl.signal.aborted || abortRef.current !== ctrl) return;
        if (!res.ok) {
          setState(UNAVAILABLE);
          return;
        }
        const body: unknown = await res.json();
        if (ctrl.signal.aborted || abortRef.current !== ctrl) return;
        const slice = (body as Record<string, unknown> | null)?.focusDays;
        setState(isFocusDaysSlice(slice) ? slice : UNAVAILABLE);
      } catch {
        if (ctrl.signal.aborted || abortRef.current !== ctrl) return;
        setState(UNAVAILABLE);
      }
    })();

    return () => ctrl.abort();
  }, [wallet, entitlementActive, hydrated, streak, lastCompletedDate, refreshToken]);

  return state;
}
