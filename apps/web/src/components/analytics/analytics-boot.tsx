"use client";

import { useEffect } from "react";
import { claimAppOpenedForVisit } from "@/lib/analytics/identity";
import { track } from "@/lib/telemetry";

/**
 * Fires the `app_opened` root event exactly once per visit (tab session),
 * independent of wallet or connection. The once-per-visit guard lives in
 * sessionStorage (claimAppOpenedForVisit), so StrictMode double-invoke,
 * remounts, and client navigation cannot double-count. Renders nothing.
 */
export function AnalyticsBoot(): null {
  useEffect(() => {
    if (claimAppOpenedForVisit()) {
      track("app_opened");
    }
  }, []);
  return null;
}
