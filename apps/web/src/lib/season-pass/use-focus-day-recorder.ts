"use client";

import { useCallback, useEffect, useRef } from "react";

import { subscribeToDailyCompleted } from "@/lib/daily/events";
import { todayUtc, yesterdayUtc } from "@/lib/daily/progress";
import { CHESSCITO_LITE_MODE } from "@/lib/feature-flags";
import type { DailyProgressState } from "@/lib/season-pass/use-learn-focus-days";

/**
 * Focus Days — the client side of the write.
 *
 * Two paths, one endpoint:
 * - **Completion**: the Daily was just recorded, so we POST with NO date. The
 *   server owns the date; a device clock ahead must not mint a day.
 * - **Retry**: on mount, a locally completed day that may never have reached
 *   the ledger (offline at the time) is reconciled with an explicit `date`,
 *   and only for [yesterday, today] — this endpoint is not a registrar of
 *   arbitrary history.
 *
 * The retry fires without knowing whether the date is already recorded, and it
 * cannot know: `/status` returns a count, not dates. The UNIQUE
 * (wallet, season_id, date_utc) is what makes that safe.
 *
 * It listens to `chesscito:daily-completed`, NEVER to
 * `chesscito:daily-progress-changed`: that one fires from two places and tests
 * emit it by hand, so a write hung off it would be minted by any re-render.
 *
 * A failure here never blocks the game (behavior 15): the Daily is already
 * complete in localStorage before this hook hears about it.
 */

export type FocusDayRecorderInput = {
  wallet: string | undefined;
  entitlementActive: boolean;
  dailyProgress: DailyProgressState;
  /** Called after the server confirms a write, so the reader can re-count. */
  onRecorded?: () => void;
};

export function useFocusDayRecorder({
  wallet,
  entitlementActive,
  dailyProgress,
  onRecorded,
}: FocusDayRecorderInput): void {
  // One entry per `(wallet, date)` already sent. A ref, not state: it must
  // survive re-renders without causing one, and a rehydration that produces
  // the same values must not buy a second POST.
  const sentRef = useRef<Set<string>>(new Set());
  const mountedRef = useRef(true);
  const onRecordedRef = useRef(onRecorded);
  onRecordedRef.current = onRecorded;

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const write = useCallback(
    async (address: string, dateUtc: string, sendDate: boolean): Promise<void> => {
      const key = `${address.toLowerCase()}:${dateUtc}`;
      if (sentRef.current.has(key)) return;
      // Claimed BEFORE awaiting: two synchronous triggers in the same tick
      // (a completion and the mount retry for the same day) must not race
      // into two requests.
      sentRef.current.add(key);

      try {
        const res = await fetch("/api/focus-day", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(sendDate ? { wallet: address, date: dateUtc } : { wallet: address }),
        });
        if (!res.ok) {
          // Nothing was recorded, so the day is still owed: release the key and
          // let the next mount reconcile it. Effect deps are unchanged, so this
          // cannot loop inside the current mount.
          sentRef.current.delete(key);
          return;
        }
        if (mountedRef.current) onRecordedRef.current?.();
      } catch {
        sentRef.current.delete(key);
      }
    },
    [],
  );

  const canWrite = CHESSCITO_LITE_MODE && Boolean(wallet) && entitlementActive;
  const lastCompletedDate =
    dailyProgress.status === "ready" ? dailyProgress.value.lastCompletedDate : null;

  // The completion write. Subscribed only while a write is legitimate, so a
  // player without wallet or entitlement never even holds the listener.
  useEffect(() => {
    if (!canWrite || !wallet) return;
    return subscribeToDailyCompleted((dateUtc) => {
      void write(wallet, dateUtc, false);
    });
  }, [canWrite, wallet, write]);

  // The retry. Bounded to [yesterday, today] on the client too — the server
  // rejects anything else, and sending it anyway would just burn the rate limit.
  useEffect(() => {
    if (!canWrite || !wallet || !lastCompletedDate) return;
    const today = todayUtc();
    if (lastCompletedDate !== today && lastCompletedDate !== yesterdayUtc(today)) return;
    void write(wallet, lastCompletedDate, true);
  }, [canWrite, wallet, lastCompletedDate, write]);
}
