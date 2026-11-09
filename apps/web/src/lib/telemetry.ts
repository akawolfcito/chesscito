/**
 * Chesscito telemetry — anonymous event stream to /api/telemetry.
 *
 * Fire-and-forget: `track()` returns synchronously and never reports errors.
 * SSR-safe (no-op on the server). Session id lives in localStorage so the same
 * user's actions over a visit are correlatable without any wallet / PII /
 * cookie involvement.
 *
 * Usage (unchanged — all 227 call sites keep working):
 *   import { track } from "@/lib/telemetry";
 *   track("share_tile_tap", { tile: "whatsapp" });
 *
 * ── Why this queues (Fase 1, 2026-08-03) ──────────────────────────────────
 *
 * Until now every `track()` opened its own POST: 54K requests in 12 h across
 * both projects, 66% of all Vercel invocations, and 1–3 sequential Supabase
 * writes each. During the Supabase 522 incident that made telemetry one of the
 * loudest writers on a database that was already depleting its Disk IO budget.
 *
 * Events are now queued and flushed in batches. Same events, same props, same
 * ordering — roughly 1/20th of the requests and of the round-trips behind them.
 *
 * ── Failure policy: DROP, never retry ─────────────────────────────────────
 *
 * A failed flush is discarded. It is NOT re-queued, NOT retried, and NOT
 * merged into the next batch. This is deliberate and is the single most
 * important property of this file: the backend failure mode we are living
 * through returns 522 for every write, and a queue that retried would convert
 * an outage into a self-inflicted storm against the exact resource that is
 * already saturated. Losing analytics during an incident is free; amplifying
 * the incident is not.
 *
 * (Confirmed 2026-08-03: nothing on this path retried before either — not the
 * browser, not `@supabase/postgrest-js` (zero occurrences of "retry" in its
 * dist), not the route. This preserves that property rather than introducing
 * one.)
 */

import { getAnonymousId } from "@/lib/analytics/identity";
import { getTelemetryAccount } from "@/lib/analytics/account";
import { clientDimensions } from "@/lib/analytics/client-dimensions";

/** Flush when the queue reaches this many events. */
export const TELEMETRY_BATCH_SIZE = 20;
/** …or this long after the most recent event, whichever comes first. */
export const TELEMETRY_FLUSH_IDLE_MS = 5_000;

/**
 * The queue can never hold more than TELEMETRY_BATCH_SIZE events, and that is
 * a consequence of the design rather than a separate limit: every push that
 * reaches the batch size flushes synchronously, and every flush empties the
 * queue whether or not the request succeeds (failures are dropped, never
 * re-queued). So there is no unbounded-buffer failure mode to defend against,
 * and no separate cap — one would be unreachable code with a test that could
 * only ever pass vacuously.
 *
 * This is also what keeps every request inside the server's 20-event limit
 * without any chunking on this side.
 */

// Runaway-bug defense: cap events at a conservative 100 per 5-min window
// per event name. If a render loop or malicious caller keeps firing the
// same event, drops kick in before we burn Supabase rows. Re-renders on
// navigation reset the window. UNCHANGED by batching — it guards against a
// different failure (a loop), and the two limits compose.
const THROTTLE_WINDOW_MS = 5 * 60 * 1000;
const THROTTLE_MAX = 100;
const throttleBucket = new Map<string, number[]>();

const LOCAL_TELEMETRY_ENABLED =
  process.env.NODE_ENV !== "development" ||
  process.env.NEXT_PUBLIC_ENABLE_LOCAL_TELEMETRY === "1";

/** Reads as OFF only for an explicit "0"/"false". An unset var means ON, so a
 *  missing env can never silently blind the funnel. */
function flagEnabled(raw: string | undefined): boolean {
  return raw !== "0" && raw?.toLowerCase() !== "false";
}

/**
 * EMERGENCY KILL SWITCH. Off ⇒ `track()` is inert: nothing is queued, no timer
 * is armed, no request is ever made. It does NOT fall back to one-request-per-
 * event — turning telemetry off must reduce load, never restore the old shape.
 */
function telemetryEnabled(): boolean {
  return flagEnabled(process.env.NEXT_PUBLIC_TELEMETRY_ENABLED);
}

/**
 * Batching switch. Off ⇒ the pre-Fase-1 behaviour, one POST per event. This is
 * a compatibility escape hatch for debugging, NOT the emergency stop — if the
 * goal is to shed load, use NEXT_PUBLIC_TELEMETRY_ENABLED.
 */
function batchEnabled(): boolean {
  return flagEnabled(process.env.NEXT_PUBLIC_TELEMETRY_BATCH_ENABLED);
}

export type TelemetryEvent = {
  session_id: string;
  event: string;
  props?: Record<string, unknown>;
  /** Stamped per event, not per batch: `surface` and `locale` change as the
   *  player navigates, and a batch can span a navigation. */
  dims: ReturnType<typeof clientDimensions>;
  /** Raw connected address, per event — the wallet can connect mid-batch. The
   *  route consumes it and writes a keyed pseudonym instead. */
  account: string | null;
};

const ENDPOINT = "/api/telemetry";

let queue: TelemetryEvent[] = [];
let idleTimer: ReturnType<typeof setTimeout> | null = null;
let listenersBound = false;

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

function clearIdleTimer(): void {
  if (idleTimer !== null) {
    clearTimeout(idleTimer);
    idleTimer = null;
  }
}

function post(body: string, preferBeacon: boolean): void {
  // `sendBeacon` is the only transport the browser guarantees during unload.
  // Same-origin + a JSON Blob, so no preflight.
  if (preferBeacon && typeof navigator !== "undefined" && navigator.sendBeacon) {
    try {
      const blob = new Blob([body], { type: "application/json" });
      if (navigator.sendBeacon(ENDPOINT, blob)) return;
      // Falls through to fetch when the beacon is refused (queue full).
    } catch {
      /* fall through */
    }
  }

  try {
    void fetch(ENDPOINT, {
      method: "POST",
      keepalive: true,
      headers: { "Content-Type": "application/json" },
      body,
    }).catch(() => {
      /* swallow — and DO NOT re-queue. See the module header. */
    });
  } catch {
    /* swallow */
  }
}

/**
 * Send everything queued right now. The queue is emptied BEFORE the request is
 * issued, so a failure discards the batch instead of retrying it.
 */
export function flushTelemetry(preferBeacon = false): void {
  clearIdleTimer();
  if (queue.length === 0) return;

  const batch = queue;
  queue = [];

  post(JSON.stringify({ events: batch }), preferBeacon);
}

function bindFlushListeners(): void {
  if (listenersBound || typeof document === "undefined") return;
  listenersBound = true;

  // `visibilitychange → hidden` is the reliable "the user is leaving" signal on
  // mobile; `pagehide` covers bfcache navigations. `beforeunload` is not used —
  // it is unreliable on mobile and blocks bfcache.
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flushTelemetry(true);
  });
  window.addEventListener("pagehide", () => flushTelemetry(true));
}

function scheduleIdleFlush(): void {
  clearIdleTimer();
  idleTimer = setTimeout(() => flushTelemetry(false), TELEMETRY_FLUSH_IDLE_MS);
}

export function track(event: string, props?: Record<string, unknown>): void {
  if (typeof window === "undefined") return;
  if (!telemetryEnabled()) return;
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
  const payload: TelemetryEvent = {
    session_id,
    event,
    props,
    dims: clientDimensions(),
    // `account` is the raw connected address and is deliberately a top-level
    // field, NOT part of `props`: props are persisted verbatim, this is
    // consumed by the route and replaced with a keyed pseudonym before
    // anything is written. Null when signed out.
    account: getTelemetryAccount(),
  };

  if (!batchEnabled()) {
    post(JSON.stringify(payload), false);
    return;
  }

  bindFlushListeners();

  queue.push(payload);

  if (queue.length >= TELEMETRY_BATCH_SIZE) {
    flushTelemetry(false);
    return;
  }
  scheduleIdleFlush();
}

/** Test hook — drops queued events and any armed timer. */
export function __resetTelemetryQueue(): void {
  clearIdleTimer();
  queue = [];
  listenersBound = false;
}

/** Test hook — how many events are waiting. */
export function __telemetryQueueSize(): number {
  return queue.length;
}
