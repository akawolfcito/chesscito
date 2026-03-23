import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { evaluateBadges } from "../badge-evaluator.js";
import type { GameRecord } from "../types.js";

function makeGame(overrides: Partial<GameRecord> = {}): GameRecord {
  return {
    gameId: crypto.randomUUID(),
    moves: ["e4", "e5"],
    result: "win",
    difficulty: "medium",
    totalMoves: 20,
    elapsedMs: 60000,
    timestamp: Date.now(),
    ...overrides,
  };
}

describe("evaluateBadges", () => {
  it("returns no earned badges for empty game list", () => {
    const badges = evaluateBadges([]);
    assert.ok(badges.every((b) => b.earned === false));
  });

  it("does not award tactics badge on easy games only", () => {
    const games = Array.from({ length: 10 }, () => makeGame({ difficulty: "easy", result: "win" }));
    const badges = evaluateBadges(games);
    const tactics = badges.find((b) => b.area === "tactics");
    assert.equal(tactics?.earned, false);
  });

  it("awards tactics badge with 40%+ win rate on hard", () => {
    const games = [
      ...Array.from({ length: 4 }, () => makeGame({ difficulty: "hard", result: "win" })),
      ...Array.from({ length: 6 }, () => makeGame({ difficulty: "hard", result: "lose" })),
    ];
    const badges = evaluateBadges(games);
    const tactics = badges.find((b) => b.area === "tactics");
    assert.equal(tactics?.earned, true);
  });

  it("requires diversity for consistency badge", () => {
    const games = Array.from({ length: 20 }, () => makeGame({ difficulty: "easy", result: "win" }));
    const badges = evaluateBadges(games);
    const consistency = badges.find((b) => b.area === "consistency");
    assert.equal(consistency?.earned, false);
  });

  it("awards consistency badge with diverse difficulties", () => {
    const games = [
      ...Array.from({ length: 3 }, () => makeGame({ difficulty: "easy", result: "win" })),
      ...Array.from({ length: 3 }, () => makeGame({ difficulty: "medium", result: "win" })),
    ];
    const badges = evaluateBadges(games);
    const consistency = badges.find((b) => b.area === "consistency");
    assert.equal(consistency?.earned, true);
  });
});
