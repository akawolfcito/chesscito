import { describe, expect, it } from "vitest";
import {
  deriveEarnedMilestones,
  type MilestoneInput,
} from "@/lib/progression/milestones";

function input(overrides: Partial<MilestoneInput> = {}): MilestoneInput {
  return {
    piece: "rook",
    lifetimeStars: 0,
    completedExercises: 0,
    pieceStars: 0,
    pieceCompletedExercises: 0,
    rookStars: 0,
    dailyStars: 0,
    sessionQuotaExhausted: false,
    badgeClaimed: false,
    allLabyrinthsComplete: false,
    hadGreatSessionBefore: false,
    ...overrides,
  };
}

function ids(result: ReturnType<typeof deriveEarnedMilestones>): string[] {
  return result.map((event) => event.id);
}

describe("first-reward", () => {
  it("does not fire on a single perfect solve — the exercise floor is not met", () => {
    const earned = deriveEarnedMilestones(
      input({ lifetimeStars: 3, completedExercises: 1 }),
    );
    expect(ids(earned)).not.toContain("first-reward");
  });

  it("fires at 4 stars across 2 exercises", () => {
    const earned = deriveEarnedMilestones(
      input({ lifetimeStars: 4, completedExercises: 2 }),
    );
    expect(ids(earned)).toContain("first-reward");
  });

  it("fires for a struggling player at 1 star across 4 exercises", () => {
    const earned = deriveEarnedMilestones(
      input({ lifetimeStars: 4, completedExercises: 4 }),
    );
    expect(ids(earned)).toContain("first-reward");
  });
});

describe("first-labyrinth", () => {
  it("does not fire at 6 piece stars across only 2 exercises", () => {
    const earned = deriveEarnedMilestones(
      input({ pieceStars: 6, pieceCompletedExercises: 2 }),
    );
    expect(ids(earned)).not.toContain("first-labyrinth");
  });

  it("fires at 6 piece stars across 3 exercises", () => {
    const earned = deriveEarnedMilestones(
      input({ pieceStars: 6, pieceCompletedExercises: 3 }),
    );
    expect(ids(earned)).toContain("first-labyrinth");
  });
});

describe("piece badge", () => {
  it("is eligible at 10 piece stars but not claimed", () => {
    const earned = deriveEarnedMilestones(input({ pieceStars: 10 }));
    expect(ids(earned)).toContain("piece-badge-eligible");
    expect(ids(earned)).not.toContain("piece-badge-claimed");
  });

  it("is claimed once the transaction confirms", () => {
    const earned = deriveEarnedMilestones(
      input({ pieceStars: 10, badgeClaimed: true }),
    );
    expect(ids(earned)).toContain("piece-badge-claimed");
  });
});

describe("mastery", () => {
  it("stays locked when every labyrinth is done but the badge was never claimed", () => {
    const earned = deriveEarnedMilestones(
      input({ pieceStars: 10, allLabyrinthsComplete: true, badgeClaimed: false }),
    );
    expect(ids(earned)).not.toContain("mastery");
  });

  it("fires when the badge is claimed and every labyrinth is done", () => {
    const earned = deriveEarnedMilestones(
      input({ pieceStars: 10, allLabyrinthsComplete: true, badgeClaimed: true }),
    );
    expect(ids(earned)).toContain("mastery");
  });
});

describe("special-training", () => {
  it("fires at 12 rook stars", () => {
    expect(ids(deriveEarnedMilestones(input({ rookStars: 12 })))).toContain(
      "special-training",
    );
  });

  it("does not fire at 11 rook stars", () => {
    expect(ids(deriveEarnedMilestones(input({ rookStars: 11 })))).not.toContain(
      "special-training",
    );
  });
});

describe("great-focus-session", () => {
  it("fires at 8 daily stars", () => {
    expect(ids(deriveEarnedMilestones(input({ dailyStars: 8 })))).toContain(
      "great-focus-session",
    );
  });

  it("fires on an exhausted quota even at 7 daily stars — the wall never beats the praise", () => {
    const earned = deriveEarnedMilestones(
      input({ dailyStars: 7, sessionQuotaExhausted: true }),
    );
    expect(ids(earned)).toContain("great-focus-session");
  });

  it("grants first-great-session only the first time", () => {
    const first = deriveEarnedMilestones(input({ dailyStars: 8 }));
    expect(ids(first)).toContain("first-great-session");

    const later = deriveEarnedMilestones(
      input({ dailyStars: 8, hadGreatSessionBefore: true }),
    );
    expect(ids(later)).toContain("great-focus-session");
    expect(ids(later)).not.toContain("first-great-session");
  });
});

describe("per-piece scoping", () => {
  it("scopes piece milestones to the piece under play", () => {
    const earned = deriveEarnedMilestones(
      input({ piece: "bishop", pieceStars: 10 }),
    );
    const badge = earned.find((event) => event.id === "piece-badge-eligible");
    expect(badge?.piece).toBe("bishop");
  });
});
