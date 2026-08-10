import { track } from "@/lib/telemetry";

import type { EarlyAccessOutcome } from "@/lib/early-access/request";
import type { ProductSurface } from "@/lib/wallet/web-access-copy";

/**
 * Access-gate analytics events. The whole set carries at most `{ surface }` —
 * never email, social name, full address, tokens, or raw errors. PII-freeness
 * is a property of this module, not of each call site: `trackWebAccess` is the
 * only way these fire, and it accepts no free-form props.
 */
export const WEB_ACCESS_EVENTS = {
  gateViewed: "web_access_gate_viewed",
  loginStarted: "web_login_started",
  loginSucceeded: "web_login_succeeded",
  walletReady: "web_wallet_ready",
  loginFailed: "web_login_failed",
} as const;

export type WebAccessEvent =
  (typeof WEB_ACCESS_EVENTS)[keyof typeof WEB_ACCESS_EVENTS];

/** Emit an access-gate event. Only the surface is ever attached. */
export function trackWebAccess(
  event: WebAccessEvent,
  surface: ProductSurface,
): void {
  track(event, { surface });
}

/**
 * Web Early Access events. A SEPARATE research channel — these must never be
 * read as E0 activation events, and nothing in E0 reads them.
 *
 * ⛔ THERE IS NO `approved_entry` EVENT, AND THAT IS A DECISION (founder,
 * 2026-08-10).
 *
 * The obvious fifth event would fire when an allowlisted player finally gets
 * in, closing the funnel requested → allowlisted → activated. We cannot emit it
 * honestly. At the moment somebody enters, all the client knows is "a browser
 * user authenticated" — it cannot tell an Early Access player from one of the
 * legacy web users Privy keeps admitting by design, because the allowlist lives
 * in Privy and the app never learns why login succeeded. An event named
 * `approved_entry` would therefore label legacy players as Early Access, and a
 * funnel built on it would overcount its own success.
 *
 * So the instrumented funnel stops where the evidence stops: at the request.
 * The rest is answered by joining `web_early_access` (who asked, when they were
 * allowlisted) against the existing per-player metrics — offline, by a human,
 * for ~25 people. Fewer events, all of them true.
 */
export const EARLY_ACCESS_EVENTS = {
  /** The request screen rendered. Provable: it is our own screen. */
  requestViewed: "web_early_access_request_viewed",
  /** A request was accepted by the server. Provable: it is the 200 response. */
  requested: "web_early_access_requested",
} as const;

export type EarlyAccessEvent =
  (typeof EARLY_ACCESS_EVENTS)[keyof typeof EARLY_ACCESS_EVENTS];

/**
 * Emit an Early Access event.
 *
 * ⛔ THE EMAIL NEVER TRAVELS. This function's signature is what guarantees it:
 * the only props it can attach are the surface and a CLOSED union of outcomes,
 * so no call site can widen the payload — the same property `trackWebAccess`
 * has, kept deliberately rather than reintroducing a free-form `props` bag for
 * the one flow in the app that handles an address.
 */
export function trackEarlyAccess(
  event: EarlyAccessEvent,
  surface: ProductSurface,
  outcome?: EarlyAccessOutcome,
): void {
  track(event, outcome ? { surface, outcome } : { surface });
}
