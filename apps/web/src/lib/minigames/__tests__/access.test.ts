import { describe, expect, it } from "vitest";

import {
  EARLY_ACCESS_POLICY,
  resolveMiniGamesAccess,
} from "@/lib/minigames/access";
import { getActiveRotation } from "@/lib/minigames/rotation";

/**
 * AC-5 — the invariant this whole slice is built around.
 *
 * Early Access is FREE. This file is the seam a future access policy would
 * plug into (`5 Peones per rotation`, `5 Peones for 7 days`, …). Today it
 * answers `allowed` unconditionally, reads no wallet, no ledger, no balance
 * and no date, and touches no payment code.
 */
describe("resolveMiniGamesAccess — the monetization seam, FREE during Early Access", () => {
  it("allows every rotation under the early-access policy", () => {
    const access = resolveMiniGamesAccess(getActiveRotation(), {});
    expect(access.allowed).toBe(true);
    expect(access.policy).toBe(EARLY_ACCESS_POLICY);
  });

  it("allows an arbitrary rotation — access does not depend on WHICH rotation", () => {
    expect(
      resolveMiniGamesAccess({ id: "some-future-rotation", items: [] }, {}).allowed,
    ).toBe(true);
  });

  it("is pure: the same inputs give the same answer, and there is no player state to read", () => {
    const rotation = getActiveRotation();
    expect(resolveMiniGamesAccess(rotation, {})).toEqual(
      resolveMiniGamesAccess(rotation, {}),
    );
  });

  /** The seam's contract: it is the ONLY place that may deny. If a future
   *  policy lands, every card and every deep link must already be asking it —
   *  which is what this assertion pins for the reviewer. */
  it("declares the early-access policy under a stable name", () => {
    expect(EARLY_ACCESS_POLICY).toBe("early_access_free");
  });
});
