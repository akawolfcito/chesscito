/**
 * Chesscito telemetry — anonymous event stream to /api/telemetry.
 *
 * Fire-and-forget: calls return synchronously with no error reporting.
 * SSR-safe (no-op on the server). Session id lives in localStorage so
 * the same user's actions over a visit are correlatable without any
 * wallet / PII / cookie involvement.
 *
 * Usage:
 *   import { track } from "@/lib/telemetry";
 *   track("share_tile_tap", { tile: "whatsapp" });
 */

import { getAnonymousId } from "@/lib/analytics/identity";
import { getTelemetryAccount } from "@/lib/analytics/account";
import { clientDimensions } from "@/lib/analytics/client-dimensions";

// Runaway-bug defense: cap events at a conservative 100 per 5-min window
// per event name. If a render loop or malicious caller keeps firing the
// same event, drops kick in before we burn Supabase rows. Re-renders on
// navigation reset the window.
const THROTTLE_WINDOW_MS = 5 * 60 * 1000;
const THROTTLE_MAX = 100;
const throttleBucket = new Map<string, number[]>();
const LOCAL_TELEMETRY_ENABLED =
  process.env.NODE_ENV !== "development" ||
  process.env.NEXT_PUBLIC_ENABLE_LOCAL_TELEMETRY === "1";

function shouldThrottle(event: string): boolean {
  const now = Date.now();
  const timestamps = (throttleBucket.get(event) ?? []).filter(
    (t) => now - t < THROTTLE_WINDOW_MS,
  );
  if (timestamps.length >= THROTTLE_MAX) return true;
  timestamps.push(now);
  throttleBucket.set(event, timestamps);
  return false;
}

export function track(event: string, props?: Record<string, unknown>): void {
  if (typeof window === "undefined") return;
  // Local development renders can double-run effects under React StrictMode
  // and dev tools can keep pages alive while profiling. Do not hit the
  // local API/Supabase path unless explicitly opted in.
  if (!LOCAL_TELEMETRY_ENABLED) return;
  if (shouldThrottle(event)) return;
  const session_id = getAnonymousId();
  if (!session_id) return;

  // Client-stamped dimensions (surface/container/locale/source/campaign/
  // app_version/visit_id). country is added server-side from the edge geo
  // header — never sent from the client. The server re-sanitizes all of this.
  const dims = clientDimensions();

  // Use keepalive + no-cache so the request survives page unload
  // (important for dock-tap → navigation flows) and doesn't share
  // anything with the browser cache.
  try {
    void fetch("/api/telemetry", {
      method: "POST",
      keepalive: true,
      headers: { "Content-Type": "application/json" },
      // `account` is the raw connected address and is deliberately a
      // top-level field, NOT part of `props`: props are persisted verbatim,
      // this is consumed by the route and replaced with a keyed pseudonym
      // before anything is written. Null when signed out.
      body: JSON.stringify({
        session_id,
        event,
        props,
        dims,
        account: getTelemetryAccount(),
      }),
    }).catch(() => {
      /* swallow — telemetry must never fail user-visible flows */
    });
  } catch {
    /* swallow */
  }
}
