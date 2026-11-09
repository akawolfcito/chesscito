import { describe, expect, it } from "vitest";

import {
  parseChallengeOrigin,
  resolveMiniGameDeepLink,
} from "@/lib/minigames/deep-link";
import { baselineMiniGamePools } from "@/lib/minigames/pools";
import { resolveChallengePool } from "@/lib/minigames/queue";

const pools = baselineMiniGamePools();
const healthyId = resolveChallengePool(pools)[0]!.challengeId;

/**
 * AC-7 / AC-8 / PART 11.
 *
 * The shipped defect this replaces: `pieceForContent()` resolved `?content=`
 * against the Knight's Tour pool ALONE, so `?content=bishop-run-1` was dropped
 * at the route boundary in silence — the player landed on a generic screen and
 * nothing looked broken.
 */
describe("resolveMiniGameDeepLink — every projected lane, not just one", () => {
  it.each([
    ["rook-rail-two-roads", "rook"],
    ["bishop-run-1", "bishop"],
    ["queens-3", "queen"],
    ["king-safe-2", "king"],
    ["knight-tour-1", "knight"],
    ["pawn-promotion-2", "pawn"],
  ])("resolves %s to the %s", (contentId, piece) => {
    const resolved = resolveMiniGameDeepLink({ contentId, pools });
    expect(resolved).not.toBeNull();
    expect(resolved!.piece).toBe(piece);
    expect(resolved!.contentId).toBe(contentId);
  });

  it("resolves every challenge of every early-access engine", () => {
    for (const id of [
      "rook-rail-two-turns",
      "rook-rail-dead-end",
      "rook-rail-rook-run",
      "rook-rail-two-roads",
      "bishop-run-1",
      "bishop-run-2",
      "bishop-run-3",
      "queens-1",
      "queens-2",
      "queens-3",
      "king-safe-1",
      "king-safe-2",
      "king-safe-3",
    ]) {
      expect(resolveMiniGameDeepLink({ contentId: id, pools })).not.toBeNull();
    }
  });

  /** AC-8 — unknown, retired and lane-1 ids all fail the same safe way. */
  it.each(["", "no-such-id", "bishop-lab-3", "knight-lab-1", "queen-lab-1"])(
    "refuses %s",
    (contentId) => {
      expect(resolveMiniGameDeepLink({ contentId, pools })).toBeNull();
    },
  );

  it("refuses a lane-1 exercise id", () => {
    expect(
      resolveMiniGameDeepLink({ contentId: pools.exercises.rook[0].id, pools }),
    ).toBeNull();
  });

  it("refuses undefined without throwing", () => {
    expect(resolveMiniGameDeepLink({ contentId: undefined, pools })).toBeNull();
  });
});

describe("origin — three destinations, not one boolean", () => {
  it.each([
    ["featured", "featured"],
    ["library", "library"],
  ])("honours ?from=%s", (raw, expected) => {
    expect(parseChallengeOrigin(raw)).toBe(expected);
  });

  /* ⛔ `exercise_path` is the FALLBACK and the URL may never assert it. Anything
     unrecognised — absent, empty, a typo, a forged value — lands there, which
     is the conservative end: it keeps the lane's progression lock. */
  it.each([undefined, "", "exercise_path", "EXERCISE_PATH", "Featured", "1", "true"])(
    "falls back to exercise_path for %s",
    (raw) => {
      expect(parseChallengeOrigin(raw as string | undefined)).toBe("exercise_path");
    },
  );

  it("defaults to exercise_path when the link names no origin", () => {
    const resolved = resolveMiniGameDeepLink({ contentId: healthyId, pools });
    expect(resolved).toMatchObject({
      origin: "exercise_path",
      bypassProgressionLock: false,
    });
  });
});

describe("the progression bypass is EARNED, never asserted", () => {
  it("grants it to a healthy challenge opened from a Mini-games surface", () => {
    for (const origin of ["featured", "library"] as const) {
      const resolved = resolveMiniGameDeepLink({ contentId: healthyId, origin, pools });
      expect(resolved).toMatchObject({ origin, bypassProgressionLock: true });
    }
  });

  it("grants it to EVERY healthy challenge, which is what makes the Library safe", () => {
    // The Library lists all 13. If the bypass only covered a curated few, the
    // other ten would be listed and then refused — visibly orphaned content.
    for (const entry of resolveChallengePool(pools)) {
      const resolved = resolveMiniGameDeepLink({
        contentId: entry.challengeId,
        origin: "library",
        pools,
      });
      expect(resolved?.bypassProgressionLock).toBe(true);
    }
  });

  /** ⛔ Not forgeable. `?from=` is client-supplied, so the STATUS decides. */
  it("refuses it for a coming-soon engine even with ?from=featured", () => {
    const resolved = resolveMiniGameDeepLink({
      contentId: "knight-tour-1",
      origin: "featured",
      pools,
    });
    expect(resolved).toMatchObject({ origin: "featured", bypassProgressionLock: false });
  });

  it("refuses it for a retired id by refusing the link outright", () => {
    for (const id of ["bishop-lab-3", "knight-lab-1", "no-such-id"]) {
      expect(
        resolveMiniGameDeepLink({ contentId: id, origin: "featured", pools }),
      ).toBeNull();
    }
  });

  it("refuses it for a lane-1 exercise id, forged origin or not", () => {
    expect(
      resolveMiniGameDeepLink({
        contentId: pools.exercises.rook[0].id,
        origin: "library",
        pools,
      }),
    ).toBeNull();
  });
});
