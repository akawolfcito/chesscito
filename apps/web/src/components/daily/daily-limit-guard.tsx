"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getDailySession, isAtFreeLimit, isAtHardMax } from "@/lib/daily/session-quota";
import { subscribeToDailySessionChanges } from "@/lib/daily/session-events";
import type { DailySessionState } from "@/lib/daily/session-quota";

/**
 * B2.3a — Lite-only daily limit gate for the exercises route.
 *
 * Renders the limit screen when the user has exhausted their free daily
 * quota (isAtFreeLimit) AND has no paid unlocks (paidUnlocked === 0).
 * Otherwise renders children unchanged.
 *
 * Only mounted by exercises/page.tsx when:
 *  - CHESSCITO_LITE_MODE is true
 *  - slot !== "daily" && slot !== "challenge"
 *
 * Full mode: never mounted → no gate.
 * Cross-tab: re-reads on visibilitychange (eventual consistency).
 */

function readSession(): DailySessionState {
  return getDailySession();
}

function isBlocked(session: DailySessionState): boolean {
  return (isAtFreeLimit(session) && session.paidUnlocked === 0) || isAtHardMax(session);
}

export function DailyLimitGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [session, setSession] = useState<DailySessionState | null>(null);

  useEffect(() => {
    setSession(readSession());

    const unsub = subscribeToDailySessionChanges(() => {
      setSession(readSession());
    });

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        setSession(readSession());
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      unsub();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  // Waiting for client hydration — render children to avoid layout flash.
  if (session === null) return <>{children}</>;

  if (isBlocked(session)) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-6 px-6 text-center">
        <p className="text-2xl font-bold text-white">Great focus today.</p>
        <p className="text-base text-white/70">Come back tomorrow for more.</p>
        <button
          onClick={() => router.push("/hub")}
          className="mt-2 rounded-full bg-white/10 px-6 py-3 text-sm font-semibold text-white"
        >
          Back to Hub
        </button>
      </div>
    );
  }

  return <>{children}</>;
}
