import { describe, expect, it, vi } from "vitest";

// Edge case from the spec: a future piece may ship exercises before any
// labyrinth exists. No piece in the real catalog is lab-less today, so the
// catalog is mocked to an empty lab list for one piece.
vi.mock("@/lib/game/exercises", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/game/exercises")>();
  return {
    ...actual,
    LABYRINTHS: { ...actual.LABYRINTHS, king: [] },
  };
});

import { EXERCISES } from "@/lib/game/exercises";
import { buildTrainingPath, getPieceMastery } from "@/lib/training/path";

describe("buildTrainingPath — piece without labyrinths", () => {
  it("builds exercises + badge + mastery with no labyrinth nodes and no crash", () => {
    const path = buildTrainingPath({
      piece: "king",
      progress: {
        piece: "king",
        currentId: null,
        // Every king exercise at 3★ (id-keyed, full mastery).
        stars: Object.fromEntries(EXERCISES.king.map((ex) => [ex.id, 3])),
      },
      labyrinthBests: {},
      badgeClaimed: true,
    });

    expect(path.filter((n) => n.kind === "labyrinth")).toHaveLength(0);
    expect(path.filter((n) => n.kind === "badge")[0].status).toBe("complete");
    // All-labs-solved is vacuously true → mastery = badge only.
    expect(path.filter((n) => n.kind === "mastery")[0].status).toBe("complete");
    expect(getPieceMastery(path)).toBe("mastered");
  });
});
