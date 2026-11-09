import { describe, expect, it } from "vitest";

import { EXERCISES } from "@/lib/game/exercises";
import { exceedsPoolCap, projectedPoolSize } from "@/lib/content/pool-capacity";

const ROOK_BASELINE = EXERCISES.rook.length;

function input(over: Partial<Parameters<typeof projectedPoolSize>[0]> = {}) {
  return {
    piece: "rook" as const,
    recordId: "rook-overlay-1",
    disabled: false,
    overlayIds: [] as readonly string[],
    ...over,
  };
}

describe("projectedPoolSize — what the merged pool becomes after this write", () => {
  it("counts a brand-new overlay exercise on top of the baseline", () => {
    expect(projectedPoolSize(input())).toBe(ROOK_BASELINE + 1);
  });

  it("does not grow when the write overwrites a baseline exercise", () => {
    expect(projectedPoolSize(input({ recordId: EXERCISES.rook[0].id }))).toBe(ROOK_BASELINE);
  });

  it("does not double-count an overlay id that is already stored", () => {
    expect(
      projectedPoolSize(input({ recordId: "rook-overlay-1", overlayIds: ["rook-overlay-1"] })),
    ).toBe(ROOK_BASELINE + 1);
  });

  it("counts every distinct overlay id already stored", () => {
    expect(
      projectedPoolSize(input({ recordId: "rook-overlay-3", overlayIds: ["rook-overlay-1", "rook-overlay-2"] })),
    ).toBe(ROOK_BASELINE + 3);
  });

  it("shrinks the pool when the write disables an overlay exercise", () => {
    expect(
      projectedPoolSize(input({ recordId: "rook-overlay-1", overlayIds: ["rook-overlay-1"], disabled: true })),
    ).toBe(ROOK_BASELINE);
  });

  it("shrinks the pool when the write disables a baseline exercise", () => {
    expect(
      projectedPoolSize(input({ recordId: EXERCISES.rook[0].id, disabled: true })),
    ).toBe(ROOK_BASELINE - 1);
  });
});

describe("exceedsPoolCap — the builder is where a too-large pool must be refused", () => {
  it("allows a write that lands exactly on the cap", () => {
    const overlayIds = Array.from({ length: 4 }, (_, i) => `rook-extra-${i}`);

    expect(
      exceedsPoolCap(input({ recordId: "rook-extra-last", overlayIds, cap: ROOK_BASELINE + 5 })),
    ).toBe(false);
  });

  it("refuses the write that would push the pool one past the cap", () => {
    const overlayIds = Array.from({ length: 5 }, (_, i) => `rook-extra-${i}`);

    expect(
      exceedsPoolCap(input({ recordId: "rook-extra-last", overlayIds, cap: ROOK_BASELINE + 5 })),
    ).toBe(true);
  });

  it("never refuses a write that shrinks the pool, even when already over the cap", () => {
    const overlayIds = Array.from({ length: 9 }, (_, i) => `rook-extra-${i}`);

    expect(
      exceedsPoolCap(
        input({ recordId: "rook-extra-0", overlayIds, disabled: true, cap: ROOK_BASELINE + 5 }),
      ),
    ).toBe(false);
  });

  it("defaults to the score invariant, so the builder and the signer agree", async () => {
    const { MAX_EXERCISES_PER_PIECE } = await import("@/lib/game/score");
    const overlayIds = Array.from(
      { length: MAX_EXERCISES_PER_PIECE - ROOK_BASELINE },
      (_, i) => `rook-extra-${i}`,
    );

    expect(exceedsPoolCap(input({ recordId: "one-too-many", overlayIds }))).toBe(true);
  });
});
