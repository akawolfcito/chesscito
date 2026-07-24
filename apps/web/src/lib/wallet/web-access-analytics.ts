import { track } from "@/lib/telemetry";

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
