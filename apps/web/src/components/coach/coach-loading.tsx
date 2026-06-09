"use client";

/**
 * CoachLoading — Sprint 6 commit B (2026-06-08) polish refresh.
 *
 * Wrapped in the new `CandyModalFrame` primitive so the surface
 * matches the candy/board lexicon shared by the rest of the
 * polish-cluster targets. Same business behaviour as the
 * pre-polish version:
 *   - polls /api/coach/job/{id} every 3s while a jobId is present
 *   - swaps the headline copy at fixed message ticks
 *   - resolves to onReady / onFailed
 *
 * Lottie removed per memory rule `feedback_no_lotties.md` — replaced
 * with a pure-CSS pulsing CandyIcon "coach" so the surface stays
 * lively without authoring new animation assets. Visual tone shifts
 * from forest-green to candy-sky so Coach reads as cool/premium and
 * stops fighting the warm-amber HUD.
 *
 * NO change to:
 *   - polling cadence / timeout (3s tick, 60s timeout)
 *   - copy keys (coachThinking / analyzing / slowThinking /
 *     keepScreenOpen) — only the typography host moved
 *   - prop shape (jobId, wallet, onReady, onFailed)
 *   - fetch URL / response handling
 *   - emit-side telemetry (none in this component)
 */

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";

import { CandyIcon } from "@/components/redesign/candy-icon";
import { CandyModalFrame } from "@/components/ui/candy-modal-frame";
import type { CoachResponse } from "@/lib/coach/types";

const TIMEOUT_MS = 60_000;

type Props = {
  jobId?: string;
  wallet?: string;
  onReady: (response: CoachResponse) => void;
  onFailed: (reason: string) => void;
};

export function CoachLoading({ jobId, wallet, onReady, onFailed }: Props) {
  const t = useTranslations("COACH_COPY");
  const [dots, setDots] = useState(".");
  const onReadyRef = useRef(onReady);
  const onFailedRef = useRef(onFailed);

  onReadyRef.current = onReady;
  onFailedRef.current = onFailed;

  const [elapsed, setElapsed] = useState(0);
  const [messageTick, setMessageTick] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setElapsed((e) => e + 1), 3000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setMessageTick((tick) => tick + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  const hasJob = Boolean(jobId);
  const filledDots = hasJob ? Math.min(5, elapsed + 1) : 0;

  useEffect(() => {
    const dotInterval = setInterval(() => {
      setDots((d) => (d.length >= 3 ? "." : d + "."));
    }, 500);

    if (!hasJob) {
      return () => clearInterval(dotInterval);
    }

    const pollInterval = setInterval(async () => {
      try {
        const params = wallet ? `?wallet=${wallet}` : "";
        const res = await fetch(`/api/coach/job/${jobId}${params}`);
        if (!res.ok) return;
        const data = await res.json();
        if (data.status === "ready") {
          clearInterval(pollInterval);
          onReadyRef.current(data.response);
        } else if (data.status === "failed") {
          clearInterval(pollInterval);
          onFailedRef.current(data.reason ?? "Unknown error");
        }
      } catch { /* retry on next poll */ }
    }, 3000);

    const timeoutId = setTimeout(() => {
      clearInterval(pollInterval);
      onFailedRef.current("Timed out waiting for coach response");
    }, TIMEOUT_MS);

    return () => {
      clearInterval(dotInterval);
      clearInterval(pollInterval);
      clearTimeout(timeoutId);
    };
  }, [jobId, wallet, hasJob]);

  const mainMessage = messageTick < 5
    ? t("coachThinking")
    : messageTick < 12
      ? t("analyzing")
      : t("slowThinking");

  const isSlowState = messageTick >= 12;

  return (
    <CandyModalFrame
      tone="sky"
      iconSlot={
        <span
          className="coach-loading-icon-wrap"
          aria-hidden="true"
        >
          <CandyIcon name="coach" className="h-12 w-12" />
        </span>
      }
      title={`${mainMessage}${dots}`}
      subtitle={!isSlowState ? t("keepScreenOpen") : undefined}
      footerSlot={
        hasJob ? (
          <div
            className="mt-1 flex items-center gap-2"
            aria-hidden="true"
            data-testid="coach-loading-dots"
          >
            {Array.from({ length: 5 }, (_, i) => (
              <span
                key={i}
                className={`h-2 w-2 rounded-full ${
                  i < filledDots
                    ? i === filledDots - 1
                      ? "bg-sky-500 animate-pulse"
                      : "bg-sky-500"
                    : "bg-sky-900/15"
                }`}
              />
            ))}
          </div>
        ) : undefined
      }
    />
  );
}
