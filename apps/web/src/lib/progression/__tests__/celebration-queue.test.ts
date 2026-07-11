import { describe, expect, it } from "vitest";
import { buildCelebrationQueue } from "@/lib/progression/celebration-queue";

describe("buildCelebrationQueue", () => {
  it("returns nothing when nothing fired", () => {
    expect(buildCelebrationQueue([])).toEqual([]);
  });

  it("shows incremental unlocks in ladder order, each its own overlay", () => {
    const queue = buildCelebrationQueue([
      { id: "special-training" },
      { id: "first-reward" },
      { id: "first-labyrinth", piece: "rook" },
    ]);
    expect(queue.map((step) => step.id)).toEqual([
      "first-reward",
      "first-labyrinth",
      "special-training",
    ]);
  });

  it("closes with the great focus session when it is the only major", () => {
    const queue = buildCelebrationQueue([
      { id: "first-reward" },
      { id: "great-focus-session" },
    ]);
    expect(queue.map((step) => step.id)).toEqual([
      "first-reward",
      "great-focus-session",
    ]);
  });

  it("renders exactly one closer and absorbs the lower major into it", () => {
    const queue = buildCelebrationQueue([
      { id: "great-focus-session" },
      { id: "mastery", piece: "rook" },
    ]);
    expect(queue).toHaveLength(1);
    expect(queue[0].id).toBe("mastery");
    expect(queue[0].absorbed).toEqual(["great-focus-session"]);
  });

  it("lets the claim flow close and absorb the session", () => {
    const queue = buildCelebrationQueue([
      { id: "great-focus-session" },
      { id: "piece-badge-eligible", piece: "rook" },
    ]);
    expect(queue).toHaveLength(1);
    expect(queue[0].id).toBe("piece-badge-eligible");
    expect(queue[0].absorbed).toEqual(["great-focus-session"]);
  });

  it("always renders first-great-session inside the closer, never alone", () => {
    const queue = buildCelebrationQueue([
      { id: "great-focus-session" },
      { id: "first-great-session" },
    ]);
    expect(queue).toHaveLength(1);
    expect(queue[0].id).toBe("great-focus-session");
    expect(queue[0].absorbed).toContain("first-great-session");
  });

  it("shows the incremental unlock before the closer when both fire", () => {
    const queue = buildCelebrationQueue([
      { id: "mastery", piece: "rook" },
      { id: "special-training" },
    ]);
    expect(queue.map((step) => step.id)).toEqual(["special-training", "mastery"]);
  });

  it("never renders two majors back to back", () => {
    const queue = buildCelebrationQueue([
      { id: "mastery", piece: "rook" },
      { id: "piece-badge-eligible", piece: "rook" },
      { id: "great-focus-session" },
    ]);
    expect(queue).toHaveLength(1);
    expect(queue[0].id).toBe("mastery");
    expect(queue[0].absorbed).toEqual([
      "piece-badge-eligible",
      "great-focus-session",
    ]);
  });

  it("drops piece-badge-claimed from the queue — the claim flow owns that moment", () => {
    const queue = buildCelebrationQueue([
      { id: "piece-badge-claimed", piece: "rook" },
    ]);
    expect(queue).toEqual([]);
  });
});
