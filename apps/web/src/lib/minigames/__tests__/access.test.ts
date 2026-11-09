import { describe, expect, it } from "vitest";

import {
  EARLY_ACCESS_POLICY,
  resolveMiniGamesAccess,
} from "@/lib/minigames/access";

/**
 * AC-5 — the invariant this whole slice is built around.
 *
 * Early Access is FREE. This file is the ALLOWED/DENIED seam. Today it answers
 * `allowed` unconditionally, reads no wallet, no ledger, no balance and no
 * date, and touches no payment code.
 *
 * ⚠️ It no longer takes a rotation (2026-08-21): there are no rotations. The
 * ALLOWANCE question — how much free content — moved to
 * `resolveConsumptionPolicy` in `lib/minigames/queue.ts`.
 */
describe("resolveMiniGamesAccess — the monetization seam, FREE during Early Access", () => {
  it("allows under the early-access policy", () => {
    const access = resolveMiniGamesAccess({});
    expect(access.allowed).toBe(true);
    expect(access.policy).toBe(EARLY_ACCESS_POLICY);
  });

  it("allows with no argument at all — there is no player state to read", () => {
    expect(resolveMiniGamesAccess().allowed).toBe(true);
  });

  it("is pure: the same input gives the same answer", () => {
    expect(resolveMiniGamesAccess({})).toEqual(resolveMiniGamesAccess({}));
  });

  /** The seam's contract: it is the ONLY place that may deny. If a future
   *  policy lands, every card and every deep link must already be asking it —
   *  which is what this assertion pins for the reviewer. */
  it("declares the early-access policy under a stable name", () => {
    expect(EARLY_ACCESS_POLICY).toBe("early_access_free");
  });
});
