import { beforeEach, describe, expect, it } from "vitest";

import { EXERCISES, KNIGHT_TOUR } from "@/lib/game/exercises";
import {
  getLabyrinthBest,
  recordTourBest,
} from "@/lib/game/labyrinth-progress";
import {
  canMountTrainingContent,
  readLastTrainingContentId,
  resolveContentAccess,
  resolveTrainingContentRequest,
  writeLastTrainingContentId,
  type EffectiveTrainingPassSnapshot,
} from "@/lib/training/content-access";

const INACTIVE: EffectiveTrainingPassSnapshot = {
  active: false,
  source: null,
  loading: false,
};
const LOADING: EffectiveTrainingPassSnapshot = {
  active: false,
  source: null,
  loading: true,
};
const DIRECT_PASS: EffectiveTrainingPassSnapshot = {
  active: true,
  source: "season_pass",
  loading: false,
};
const PRO: EffectiveTrainingPassSnapshot = {
  active: true,
  source: "pro",
  loading: false,
};

const [baseTour, premiumTour] = KNIGHT_TOUR.knight;

describe("Training content access", () => {
  beforeEach(() => localStorage.clear());

  it("ships one base Tour and two Training Pass variants", () => {
    expect(KNIGHT_TOUR.knight.map((tour) => [tour.id, tour.access])).toEqual([
      ["knight-tour-1", "base"],
      ["knight-tour-2", "training_pass"],
      ["knight-tour-3", "training_pass"],
    ]);
  });

  it("keeps base content accessible without entitlement", () => {
    expect(resolveContentAccess(baseTour, INACTIVE)).toEqual({ allowed: true });
  });

  it("defaults missing metadata to base", () => {
    expect(resolveContentAccess(EXERCISES.rook[0], INACTIVE)).toEqual({ allowed: true });
  });

  it("blocks premium content without an effective entitlement", () => {
    expect(resolveContentAccess(premiumTour, INACTIVE)).toEqual({
      allowed: false,
      reason: "training_pass_required",
    });
  });

  it.each([
    ["direct Season Pass", DIRECT_PASS],
    ["PRO", PRO],
  ])("unlocks premium content with %s", (_label, entitlement) => {
    expect(resolveContentAccess(premiumTour, entitlement)).toEqual({ allowed: true });
  });

  it("keeps unresolved entitlement pending rather than locked", () => {
    expect(resolveContentAccess(premiumTour, LOADING)).toEqual({ pending: true });
  });

  it.each(["direct", "restore", "automatic"] as const)(
    "%s denial returns to Path without opening checkout",
    (source) => {
      expect(
        resolveTrainingContentRequest({
          contentId: premiumTour.id,
          catalog: KNIGHT_TOUR.knight,
          trainingPass: INACTIVE,
          source,
        }),
      ).toMatchObject({ action: "locked", openCheckout: false });
    },
  );

  it("only an explicit locked-node tap may open checkout", () => {
    expect(
      resolveTrainingContentRequest({
        contentId: premiumTour.id,
        catalog: KNIGHT_TOUR.knight,
        trainingPass: INACTIVE,
        source: "explicit_tap",
      }),
    ).toMatchObject({ action: "locked", openCheckout: true });
  });

  it("rejects stale/manual ids without treating them as commercial content", () => {
    expect(
      resolveTrainingContentRequest({
        contentId: "knight-tour-retired",
        catalog: KNIGHT_TOUR.knight,
        trainingPass: PRO,
        source: "direct",
      }),
    ).toEqual({ action: "missing" });
  });

  it("lets an authorized mounted attempt finish after expiry but blocks a new mount", () => {
    expect(
      canMountTrainingContent({
        content: premiumTour,
        trainingPass: INACTIVE,
        attemptGrantId: premiumTour.id,
      }),
    ).toBe(true);
    expect(
      canMountTrainingContent({
        content: premiumTour,
        trainingPass: INACTIVE,
        attemptGrantId: null,
      }),
    ).toBe(false);
  });

  it("preserves a premium best and restored id after entitlement expires", () => {
    recordTourBest("knight", premiumTour.id, 18);
    writeLastTrainingContentId("knight", premiumTour.id);

    expect(
      resolveTrainingContentRequest({
        contentId: readLastTrainingContentId("knight")!,
        catalog: KNIGHT_TOUR.knight,
        trainingPass: INACTIVE,
        source: "restore",
      }),
    ).toMatchObject({ action: "locked", openCheckout: false });
    expect(getLabyrinthBest("knight", premiumTour.id)).toBe(18);
    expect(readLastTrainingContentId("knight")).toBe(premiumTour.id);
  });

  it("does not gate any existing curricular exercise", () => {
    const exercises = Object.values(EXERCISES).flat();
    // Not pinned to a total (was 59, stale the day the bishop got a tenth board):
    // the claim is that NO curricular exercise is behind the pass, whatever the
    // catalog grows to. A non-empty catalog keeps the assertion meaningful.
    expect(exercises.length).toBeGreaterThan(0);
    expect(exercises.every((exercise) => exercise.access !== "training_pass")).toBe(true);
  });
});
