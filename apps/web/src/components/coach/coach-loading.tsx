"use client";

/**
 * CoachLoading — Sprint 6 commit B (2026-06-08) polish refresh.
 *
 * Wrapped in the new `CandyModalFrame` primitive so the surface
 * matches the candy/board lexicon shared by the rest of the
 * polish-cluster targets. Same business behaviour as the
 * pre-polish version:
 *   - polls /api/coach/job/{id} 3s after each completed request
 *   - swaps the headline copy at fixed message ticks
 *   - resolves to onReady / onFailed
 *
 * Lottie hourglass (`sandy-loading.lottie`) RESTORED 2026-06-08 after
 * founder clarification: continuous-motion hourglass carries the
 * "actively working" feel better than a CSS pulse for the 5-10s the
 * LLM takes. The memory rule about Lotties is case-by-case, not a
 * hard ban (see `feedback_no_lotties.md`). Visual tone still shifts
 * from forest-green to candy-sky so Coach reads as cool/premium and
 * stops fighting the warm-amber HUD.
 *
 * Polling is serialized, pauses in hidden tabs, and stops at a 60s deadline.
 * NO change to:
 *   - copy keys (coachThinking / analyzing / slowThinking /
 *     keepScreenOpen) — only the typography host moved
 *   - prop shape (jobId, wallet, onReady, onFailed)
 *   - fetch URL / response handling
 *   - emit-side telemetry (none in this component)
 */

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";

import { LottieAnimation } from "@/components/ui/lottie-animation";
import { CandyModalFrame } from "@/components/ui/candy-modal-frame";
import type { CoachResponse } from "@/lib/coach/types";
import { useCoachJobAccess } from "@/lib/coach/use-coach-request-access";

const TIMEOUT_MS = 60_000;

type Props = {
  jobId?: string;
  wallet?: string;
  onReady: (response: CoachResponse) => void;
  onFailed: (reason: string) => void;
};

export function CoachLoading({ jobId, wallet, onReady, onFailed }: Props) {
  const jobHeaders = useCoachJobAccess(wallet);
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

    let pollAttempt = 0;
    let stopped = false;
    let pollTimer: ReturnType<typeof setTimeout>;
    const controller = new AbortController();

    const stop = () => {
      stopped = true;
      clearTimeout(pollTimer);
      clearTimeout(timeoutId);
      controller.abort();
    };

    const poll = async () => {
      if (stopped) return;
      // A background MiniPay WebView need not keep invoking the job route.
      // The original 60s deadline still bounds the whole loading session.
      if (!document.hidden) {
        try {
          const authorization = jobHeaders(jobId!);
          if (!authorization) {
            stop();
            onFailedRef.current("Coach authorization required");
            return;
          }
          const params = wallet ? `?wallet=${encodeURIComponent(wallet)}` : "";
          pollAttempt += 1;
          const res = await fetch(`/api/coach/job/${jobId}${params}`, {
            headers: { ...authorization, "x-chesscito-poll-attempt": String(pollAttempt) },
            cache: "no-store",
            signal: controller.signal,
          });
          if (res.ok) {
            const data = await res.json();
            // Fetch or JSON parsing may settle after cleanup or the deadline.
            if (stopped || !jobHeaders(jobId!)) return;
            if (data.status === "ready") {
              stop();
              onReadyRef.current(data.response);
              return;
            }
            if (data.status === "failed") {
              stop();
              onFailedRef.current(data.reason ?? "Unknown error");
              return;
            }
          }
        } catch { /* retry on next poll, within the original deadline */ }
      }
      // Schedule only AFTER settling: slow requests cannot overlap.
      if (!stopped) pollTimer = setTimeout(poll, 3000);
    };

    const timeoutId = setTimeout(() => {
      stop();
      onFailedRef.current("Timed out waiting for coach response");
    }, TIMEOUT_MS);
    pollTimer = setTimeout(poll, 3000);

    return () => {
      clearInterval(dotInterval);
      stop();
    };
  }, [jobId, wallet, hasJob, jobHeaders]);

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
        <span className="block h-16 w-16" aria-hidden="true">
          <LottieAnimation
            src="/animations/sandy-loading.lottie"
            loop
            className="h-full w-full"
          />
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
