/**
 * PRO expires, so PRO is not `unbounded`.
 *
 * ⛔ THE BUG THIS CLOSES. `focusWindow` returned `{ kind: "unbounded" }` for
 * every PRO holder, and `isUnreachable()` short-circuits to `false` on an
 * unbounded window. So a PRO user was told the 21-day challenge was still
 * reachable no matter how few days their subscription had left.
 *
 * Measured in production on 2026-08-25: the ONLY user with meaningful progress
 * (10/21 Focus Days) needed 11 more days and had 8 left on PRO. The product
 * was promising the one committed player something arithmetically impossible.
 *
 * `unbounded` now means what it says: an entitlement with NO expiry at all.
 * A PRO subscription with a date is an `expiring` window like any other.
 *
 * Audit: docs/audits/2026-08-25-play-first-pivot-evidence.md §6
 */
import { describe, expect, it } from "vitest";

import {
  buildChallengeProgressView,
  focusWindow,
  type ChallengeCardEntitlement,
} from "../challenge-card-view";
import { isUnreachable } from "../focus-days";

/** 2026-08-25T00:00:00Z */
const NOW = Date.parse("2026-08-25T00:00:00.000Z");
const inDays = (n: number) =>
  new Date(NOW + n * 86_400_000).toISOString();

const slice = (completed: number) =>
  ({ status: "ok", completed, goal: 21, seasonId: "s" }) as const;

describe("focusWindow — PRO carries its own deadline", () => {
  it("gives PRO an expiring window derived from its own expiry", () => {
    const window = focusWindow({
      source: "pro",
      seasonPassExpiresAt: null,
      proExpiresAt: inDays(8),
      nowMs: NOW,
    });

    expect(window).toEqual({ kind: "expiring", daysRemaining: 8 });
  });

  it("keeps unbounded ONLY for an entitlement with no expiry at all", () => {
    // The escape hatch stays: a lifetime grant has nothing to count down.
    expect(
      focusWindow({
        source: "pro",
        seasonPassExpiresAt: null,
        proExpiresAt: null,
        nowMs: NOW,
      }),
    ).toEqual({ kind: "unbounded" });
  });

  it("still reads a season pass from the pass expiry", () => {
    expect(
      focusWindow({
        source: "season_pass",
        seasonPassExpiresAt: inDays(19),
        proExpiresAt: null,
        nowMs: NOW,
      }),
    ).toEqual({ kind: "expiring", daysRemaining: 19 });
  });

  it("reads a lapsed pass as zero days, not as a missing window", () => {
    expect(
      focusWindow({
        source: "season_pass",
        seasonPassExpiresAt: inDays(-3),
        proExpiresAt: null,
        nowMs: NOW,
      }),
    ).toEqual({ kind: "expiring", daysRemaining: 0 });
  });
});

describe("isUnreachable — the six cases", () => {
  const goal = 21;

  it("1. season pass with time to spare is reachable", () => {
    const progress = { completed: 2, goal };
    expect(
      isUnreachable(progress, { kind: "expiring", daysRemaining: 25 }),
    ).toBe(false);
  });

  it("2. season pass already short of days is unreachable", () => {
    const progress = { completed: 2, goal }; // owes 19
    expect(
      isUnreachable(progress, { kind: "expiring", daysRemaining: 8 }),
    ).toBe(true);
  });

  it("3. PRO with enough days is reachable", () => {
    const progress = { completed: 10, goal }; // owes 11
    const window = focusWindow({
      source: "pro",
      seasonPassExpiresAt: null,
      proExpiresAt: inDays(15),
      nowMs: NOW,
    });
    expect(isUnreachable(progress, window)).toBe(false);
  });

  it("4. PRO with fewer days than owed is UNREACHABLE — the production case", () => {
    // The real user: 10/21, owes 11, PRO expires in 8.
    const progress = { completed: 10, goal };
    const window = focusWindow({
      source: "pro",
      seasonPassExpiresAt: null,
      proExpiresAt: inDays(8),
      nowMs: NOW,
    });

    expect(window).toEqual({ kind: "expiring", daysRemaining: 8 });
    expect(isUnreachable(progress, window)).toBe(true);
  });

  it("5. a truly unbounded entitlement is never unreachable", () => {
    expect(isUnreachable({ completed: 0, goal }, { kind: "unbounded" })).toBe(
      false,
    );
  });

  it("6. expired season pass + live PRO follows the PRO deadline", () => {
    // Exactly the production shape: pass lapsed 2026-08-10, PRO live to 09-02.
    const window = focusWindow({
      source: "pro",
      seasonPassExpiresAt: inDays(-15),
      proExpiresAt: inDays(8),
      nowMs: NOW,
    });

    expect(window).toEqual({ kind: "expiring", daysRemaining: 8 });
    expect(isUnreachable({ completed: 10, goal }, window)).toBe(true);
  });

  it("never calls a met goal unreachable, however little time is left", () => {
    expect(
      isUnreachable({ completed: 21, goal }, { kind: "expiring", daysRemaining: 0 }),
    ).toBe(false);
  });
});

describe("buildChallengeProgressView with PRO", () => {
  it("marks the view unreachable when PRO runs out first", () => {
    const entitlement: ChallengeCardEntitlement = {
      status: "active",
      source: "pro",
      seasonPassExpiresAt: null,
      proExpiresAt: inDays(8),
    };

    const view = buildChallengeProgressView({
      entitlement,
      slice: slice(10),
      streak: 4,
      nowMs: NOW,
    });

    expect(view.state).toBe("active");
    if (view.state !== "active") throw new Error("unreachable");
    expect(view.unreachable).toBe(true);
    expect(view.window).toEqual({ kind: "expiring", daysRemaining: 8 });
  });

  it("still reports completed when the goal is met on PRO", () => {
    const view = buildChallengeProgressView({
      entitlement: {
        status: "active",
        source: "pro",
        seasonPassExpiresAt: null,
        proExpiresAt: inDays(1),
      },
      slice: slice(21),
      streak: 21,
      nowMs: NOW,
    });

    expect(view.state).toBe("completed");
  });
});
