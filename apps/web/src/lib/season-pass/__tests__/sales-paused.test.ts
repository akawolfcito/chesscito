/**
 * Pausing Season Pass SALES must not touch anyone who already paid.
 *
 * Evidence for the pause (2026-08-25): 17 wallets bought the $0.99 pass, 10 of
 * them never recorded a single Focus Day, exactly ZERO completed the 21 days,
 * and the best result in 36 days of possibility was 10/21. Selling a challenge
 * with a 0/18 completion rate is the most concrete reputational exposure the
 * product has.
 *
 * ⛔ THE INVARIANT: this is a pause on the OFFER, not a revocation. An active
 * entitlement renders exactly as before, and the flag is a single env read so
 * turning sales back on needs no migration and no code change.
 *
 * Audit: docs/audits/2026-08-25-play-first-pivot-evidence.md §5
 */
import { describe, expect, it } from "vitest";

import {
  buildChallengeProgressView,
  type ChallengeCardEntitlement,
} from "../challenge-card-view";

const NOW = Date.parse("2026-08-25T00:00:00.000Z");
const inDays = (n: number) => new Date(NOW + n * 86_400_000).toISOString();

const slice = (completed: number) =>
  ({ status: "ok", completed, goal: 21, seasonId: "s" }) as const;

const NO_ENTITLEMENT: ChallengeCardEntitlement = { status: "none" };

const ACTIVE_PASS: ChallengeCardEntitlement = {
  status: "active",
  source: "season_pass",
  seasonPassExpiresAt: inDays(19),
  proExpiresAt: null,
};

describe("season pass sales pause", () => {
  it("offers the pass when sales are ON", () => {
    const view = buildChallengeProgressView({
      entitlement: NO_ENTITLEMENT,
      slice: null,
      streak: 0,
      nowMs: NOW,
      salesPaused: false,
    });

    expect(view.state).toBe("offer");
  });

  it("does NOT offer the pass when sales are paused", () => {
    const view = buildChallengeProgressView({
      entitlement: NO_ENTITLEMENT,
      slice: null,
      streak: 0,
      nowMs: NOW,
      salesPaused: true,
    });

    expect(view.state).toBe("unavailable");
  });

  it("⛔ a paid, active pass is UNAFFECTED by the pause", () => {
    // The whole point. Pausing sales must never look like a revocation to
    // someone who already paid $0.99.
    const view = buildChallengeProgressView({
      entitlement: ACTIVE_PASS,
      slice: slice(4),
      streak: 2,
      nowMs: NOW,
      salesPaused: true,
    });

    expect(view.state).toBe("active");
    if (view.state !== "active") throw new Error("unreachable");
    expect(view.progress).toEqual({ completed: 4, goal: 21 });
    expect(view.window).toEqual({ kind: "expiring", daysRemaining: 19 });
  });

  it("a completed challenge still reads completed while sales are paused", () => {
    const view = buildChallengeProgressView({
      entitlement: ACTIVE_PASS,
      slice: slice(21),
      streak: 21,
      nowMs: NOW,
      salesPaused: true,
    });

    expect(view.state).toBe("completed");
  });

  it("PRO holders keep their challenge while sales are paused", () => {
    const view = buildChallengeProgressView({
      entitlement: {
        status: "active",
        source: "pro",
        seasonPassExpiresAt: null,
        proExpiresAt: inDays(30),
      },
      slice: slice(10),
      streak: 4,
      nowMs: NOW,
      salesPaused: true,
    });

    expect(view.state).toBe("active");
  });

  it("defaults to offering, so omitting the flag cannot silently hide the pass", () => {
    const view = buildChallengeProgressView({
      entitlement: NO_ENTITLEMENT,
      slice: null,
      streak: 0,
      nowMs: NOW,
    });

    expect(view.state).toBe("offer");
  });

  it("still reports loading before the entitlement answers, paused or not", () => {
    expect(
      buildChallengeProgressView({
        entitlement: { status: "loading" },
        slice: null,
        streak: 0,
        nowMs: NOW,
        salesPaused: true,
      }).state,
    ).toBe("loading");
  });
});
