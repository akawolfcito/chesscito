import { describe, expect, it } from "vitest";
import { defaultMiniGamePools } from "@/lib/minigames/catalog";
import { resolveChallengePool } from "@/lib/minigames/queue";

/**
 * ⛔ THE TRIPWIRE UNDER THE EXERCISES SEPARATION.
 *
 * The Season-Pass unlock CTA for lane content renders on a LOCKED LANE ROW in
 * the path drawer (`exercise-drawer.tsx:477`). Since 2026-08-21 LEARN draws no
 * lane rows — mini-games live in the Library — so a pass-gated mini-game would
 * be listed in the Library, refused by the commercial check on tap, and offer
 * the player nothing at all. A silent dead end.
 *
 * It cannot happen today because no healthy challenge is gated. This test is
 * what keeps that true: authoring an `entitlement` onto one turns the suite red
 * instead of shipping the dead end.
 *
 * ⚠️ The fix, if that day comes, is NOT to re-add lane rows to the Exercises
 * path. It is to give the Library row the unlock CTA the drawer row had.
 */
describe("no healthy mini-game is entitlement-gated", () => {
  const pool = resolveChallengePool(defaultMiniGamePools());

  it("has challenges to check", () => {
    expect(pool.length).toBeGreaterThan(0);
  });

  it.each(pool.map((entry) => [entry.challengeId, entry] as const))(
    "%s is free to open",
    (_id, entry) => {
      // `access` is the additive entitlement requirement; absent means `base`.
      expect(entry.challenge.access ?? "base").toBe("base");
    },
  );
});
