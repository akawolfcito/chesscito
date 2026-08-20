import { describe, expect, it } from "vitest";

import { resolveMiniGameDeepLink } from "@/lib/minigames/deep-link";
import { baselineMiniGamePools } from "@/lib/minigames/pools";
import { ACTIVE_ROTATION_ID, getActiveRotation } from "@/lib/minigames/rotation";

const pools = baselineMiniGamePools();
const featuredId = getActiveRotation().items[0];

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

describe("resolveMiniGameDeepLink — the `featured` flag is EARNED, never asserted", () => {
  it("marks featured only when the id is in the named rotation", () => {
    const resolved = resolveMiniGameDeepLink({
      contentId: featuredId,
      rotationId: ACTIVE_ROTATION_ID,
      pools,
    });
    expect(resolved).toMatchObject({ featured: true, rotationId: ACTIVE_ROTATION_ID });
  });

  /** ⛔ The bypass must not be forgeable. `?featured=` is a client-supplied
   *  string; if it were trusted, any lane id could skip its gate. It is only
   *  honoured when the id is genuinely in that rotation. */
  it("refuses the featured flag for an id that rotation does not feature", () => {
    const notFeatured = "rook-rail-two-turns";
    expect(getActiveRotation().items).not.toContain(notFeatured);
    const resolved = resolveMiniGameDeepLink({
      contentId: notFeatured,
      rotationId: ACTIVE_ROTATION_ID,
      pools,
    });
    expect(resolved).toMatchObject({ featured: false });
    expect(resolved!.rotationId).toBeNull();
  });

  it("refuses the featured flag for an unknown rotation id", () => {
    const resolved = resolveMiniGameDeepLink({
      contentId: featuredId,
      rotationId: "no-such-rotation",
      pools,
    });
    expect(resolved).toMatchObject({ featured: false, rotationId: null });
  });

  it("is not featured when no rotation is named — a bare deep link keeps its gate", () => {
    const resolved = resolveMiniGameDeepLink({ contentId: featuredId, pools });
    expect(resolved).toMatchObject({ featured: false, rotationId: null });
  });

  /** AC-9 as a routing guarantee: a coming-soon id can be reached by a hand-typed
   *  URL (it is real content) but can never be FEATURED, because it cannot be in
   *  a rotation. */
  it("never marks a coming-soon challenge featured", () => {
    const resolved = resolveMiniGameDeepLink({
      contentId: "knight-tour-1",
      rotationId: ACTIVE_ROTATION_ID,
      pools,
    });
    expect(resolved).toMatchObject({ featured: false });
  });
});
