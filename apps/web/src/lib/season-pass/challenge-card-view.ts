import { daysRemaining } from "@/lib/pro/days-remaining";
import {
  challengeProgressView,
  type ChallengeProgressView,
  type FocusDaysSlice,
  type FocusWindow,
} from "@/lib/season-pass/focus-days";

/** What the entitlement layer knows, reduced to what the card needs. Built
 *  from the GLOBAL provider's snapshot — never from the LEARN Focus Days
 *  request, which must not become a second authority on paid access
 *  (founder, 2026-07-27). */
export type ChallengeCardEntitlement =
  | { status: "loading" }
  | { status: "none" }
  | {
      status: "active";
      source: "pro" | "season_pass";
      /** ISO string. The status payload rejects an active season pass without
       *  a valid one, so this is only ever null/invalid for PRO. */
      seasonPassExpiresAt: string | null;
    };

/** PRO has access with no window to count down; a season pass has a deadline.
 *
 *  `daysRemaining` returns null once the expiry is in the past. For a pass the
 *  resolver still calls active that means it lapsed while the page was open,
 *  so 0 is the accurate reading — not a missing window. */
export function focusWindow(input: {
  source: "pro" | "season_pass";
  seasonPassExpiresAt: string | null;
  nowMs: number;
}): FocusWindow {
  if (input.source === "pro") return { kind: "unbounded" };
  const expiresAtMs = input.seasonPassExpiresAt
    ? Date.parse(input.seasonPassExpiresAt)
    : null;
  return {
    kind: "expiring",
    daysRemaining: daysRemaining(Number.isNaN(expiresAtMs) ? null : expiresAtMs, input.nowMs) ?? 0,
  };
}

/** The card's whole state, in one place.
 *
 *  Stage 1's `challengeProgressView` already owns everything downstream of an
 *  answered ledger; this adds only the two states that come from the
 *  entitlement side and cannot be derived from a slice: `loading` and `offer`.
 *
 *  `slice: null` means the LEARN read has not answered yet (idle or in
 *  flight). That is `loading`, NOT `degraded`: we have not failed, we have not
 *  asked yet — and it is certainly not a zero. */
export function buildChallengeProgressView(input: {
  entitlement: ChallengeCardEntitlement;
  slice: FocusDaysSlice | null;
  streak: number;
  nowMs: number;
}): ChallengeProgressView {
  const { entitlement, slice, streak, nowMs } = input;

  if (entitlement.status === "loading") return { state: "loading" };
  if (entitlement.status === "none") return { state: "offer" };
  if (slice === null) return { state: "loading" };

  return challengeProgressView({
    slice,
    window: focusWindow({
      source: entitlement.source,
      seasonPassExpiresAt: entitlement.seasonPassExpiresAt,
      nowMs,
    }),
    streak: Math.max(0, streak),
  });
}
