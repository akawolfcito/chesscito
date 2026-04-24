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

const SESSION_KEY = "chesscito:analytics-session";

// Runaway-bug defense: cap events at a conservative 100 per 5-min window
// per event name. If a render loop or malicious caller keeps firing the
// same event, drops kick in before we burn Supabase rows. Re-renders on
// navigation reset the window.
const THROTTLE_WINDOW_MS = 5 * 60 * 1000;
const THROTTLE_MAX = 100;
const throttleBucket = new Map<string, number[]>();

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

function getSessionId(): string {
  if (typeof window === "undefined") return "";
  try {
    const existing = window.localStorage.getItem(SESSION_KEY);
    if (existing) return existing;
    // 16 random hex chars (~64 bits) — plenty for our scale, short
    // enough to stay under the 64-char session id column.
    const bytes = new Uint8Array(8);
    window.crypto.getRandomValues(bytes);
    const id = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
    window.localStorage.setItem(SESSION_KEY, id);
    return id;
  } catch {
    return "";
  }
}

export function track(event: string, props?: Record<string, unknown>): void {
  if (typeof window === "undefined") return;
  if (shouldThrottle(event)) return;
  const session_id = getSessionId();
  if (!session_id) return;

  // Use keepalive + no-cache so the request survives page unload
  // (important for dock-tap → navigation flows) and doesn't share
  // anything with the browser cache.
  try {
    void fetch("/api/telemetry", {
      method: "POST",
      keepalive: true,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_id, event, props }),
    }).catch(() => {
      /* swallow — telemetry must never fail user-visible flows */
    });
  } catch {
    /* swallow */
  }
}
