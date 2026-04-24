"use client";

import { useEffect, useRef, useState } from "react";
import { COACH_COPY } from "@/lib/content/editorial";
import { LottieAnimation } from "@/components/ui/lottie-animation";
import { CandyIcon } from "@/components/redesign/candy-icon";
import type { CoachResponse } from "@/lib/coach/types";

const TIMEOUT_MS = 60_000;

type Props = {
  jobId: string;
  wallet?: string;
  onReady: (response: CoachResponse) => void;
  onFailed: (reason: string) => void;
};

export function CoachLoading({ jobId, wallet, onReady, onFailed }: Props) {
  const [dots, setDots] = useState(".");
  const onReadyRef = useRef(onReady);
  const onFailedRef = useRef(onFailed);

  onReadyRef.current = onReady;
  onFailedRef.current = onFailed;

  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setElapsed((e) => e + 1), 3000);
    return () => clearInterval(timer);
  }, []);

  const filledDots = Math.min(5, elapsed + 1);

  useEffect(() => {
    const dotInterval = setInterval(() => {
      setDots((d) => (d.length >= 3 ? "." : d + "."));
    }, 500);

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
  }, [jobId, wallet]);

  return (
    <div className="flex flex-col items-center gap-3 py-2 text-center">
      <div className="h-16 w-16">
        <LottieAnimation src="/animations/sandy-loading.lottie" loop className="h-full w-full" />
      </div>
      <p
        className="flex items-center justify-center gap-1.5 text-base font-bold"
        style={{
          color: "rgba(63, 34, 8, 0.95)",
          textShadow: "0 1px 0 rgba(255, 245, 215, 0.65)",
        }}
      >
        <CandyIcon name="coach" className="h-5 w-5" />
        {COACH_COPY.analyzing}{dots}
      </p>
      <p className="text-sm" style={{ color: "rgba(110, 65, 15, 0.75)" }}>
        {COACH_COPY.reviewingMoves}
      </p>

      {/* Progress dots */}
      <div className="flex items-center gap-2">
        {Array.from({ length: 5 }, (_, i) => (
          <div
            key={i}
            className={`h-2 w-2 rounded-full ${
              i < filledDots
                ? i === filledDots - 1
                  ? "bg-emerald-500 animate-pulse"
                  : "bg-emerald-500"
                : ""
            }`}
            style={i >= filledDots ? { background: "rgba(110, 65, 15, 0.25)" } : undefined}
          />
        ))}
      </div>

      <p className="mt-1 text-xs" style={{ color: "rgba(110, 65, 15, 0.55)" }}>
        {COACH_COPY.loadingCanLeave}
      </p>
    </div>
  );
}
