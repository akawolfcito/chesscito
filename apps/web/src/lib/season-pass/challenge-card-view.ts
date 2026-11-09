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
      /** ISO string. REQUIRED, not optional: PRO expires, and omitting it is
       *  exactly how the challenge came to promise an impossible finish.
       *  `null` means an entitlement with genuinely no expiry. */
      proExpiresAt: string | null;
    };

/** The deadline that actually governs the challenge, whichever entitlement
 *  is paying for it.
 *
 *  ⛔ PRO USED TO RETURN `unbounded` HERE, AND THAT WAS THE BUG. PRO has an
 *  `expires_at`; treating it as "no deadline" made `isUnreachable()`
 *  short-circuit to false, so a PRO holder was told the 21 days were still
 *  reachable with any number of days left. Measured 2026-08-25: the only user
 *  at 10/21 needed 11 days and had 8 — the product was promising the one
 *  committed player something arithmetically impossible.
 *
 *  `unbounded` now means what the word means: NO expiry at all. Pass a null
 *  `proExpiresAt` only for an entitlement that genuinely never lapses.
 *
 *  `daysRemaining` returns null once the expiry is in the past. For an
 *  entitlement the resolver still calls active, that means it lapsed while the
 *  page was open, so 0 is the accurate reading — not a missing window. */
export function focusWindow(input: {
  source: "pro" | "season_pass";
  seasonPassExpiresAt: string | null;
  proExpiresAt: string | null;
  nowMs: number;
}): FocusWindow {
  const iso =
    input.source === "pro" ? input.proExpiresAt : input.seasonPassExpiresAt;

  // No date to count down against — the only honest unbounded case.
  if (iso === null) return { kind: "unbounded" };

  const expiresAtMs = Date.parse(iso);
  return {
    kind: "expiring",
    daysRemaining:
      daysRemaining(Number.isNaN(expiresAtMs) ? null : expiresAtMs, input.nowMs) ?? 0,
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
  /** Season Pass sales paused (2026-08-25). Suppresses the OFFER only — an
   *  entitlement anyone already paid for renders exactly as before. Defaults
   *  to false so forgetting the flag cannot silently hide the pass. */
  salesPaused?: boolean;
}): ChallengeProgressView {
  const { entitlement, slice, streak, nowMs, salesPaused = false } = input;

  /* ⛔ THE PAUSE IS CHECKED BEFORE `loading`, and the order is the whole fix.
   *
   * Returning `loading` first meant the card fell through to its full offer
   * while the entitlement resolved: for the second or two before the answer
   * arrived, a paused product was on screen with its benefits row and its
   * $0.99 banner, and then swapped to the habit panel. The founder saw it on
   * every cold start (2026-08-26).
   *
   * With sales off there is nothing to wait FOR: no entitlement means the habit
   * panel, and an entitlement means the card comes back a beat later. Choosing
   * the habit while we do not know is the only option that cannot advertise
   * something we decided to stop selling.
   *
   * ⚠️ Sales ON keeps its skeleton — the people who can actually buy still need
   * a loading state. */
  if (entitlement.status === "loading") {
    // ⚠️ `pending` — see the union. The paused offer must not show while we
    // wait, but neither may the card claim there is no challenge: for the 11
    // people holding an active pass this branch runs on every cold load, and
    // collapsing their counter and deadline makes the card jump a beat later.
    return salesPaused ? { state: "unavailable", pending: true } : { state: "loading" };
  }
  if (entitlement.status === "none") {
    /* ⛔ THE PAUSE STOPS AT THE OFFER. 17 wallets bought the pass, 10 never
     * recorded a Focus Day and 0 of 18 finished the 21 days; selling it while
     * that is true is the sharpest reputational exposure the product has. But
     * the people who already paid keep everything — this branch is only
     * reached when there is NO entitlement to protect. */
    return salesPaused ? { state: "unavailable" } : { state: "offer" };
  }
  if (slice === null) return { state: "loading" };

  return challengeProgressView({
    slice,
    window: focusWindow({
      source: entitlement.source,
      seasonPassExpiresAt: entitlement.seasonPassExpiresAt,
      proExpiresAt: entitlement.proExpiresAt,
      nowMs,
    }),
    streak: Math.max(0, streak),
  });
}
