import { describe, it, expect } from "vitest";
import { computeAchievements } from "../compute";
import type { VictoryEntry } from "@/lib/game/victory-events";

function victory(over: Partial<VictoryEntry>): VictoryEntry {
  return {
    tokenId: 1n,
    player: "0xcc4179a22b473ea2eb2b9b9b210458d0f60fc2dd",
    difficulty: 1,
    totalMoves: 50,
    timeMs: 60_000,
    blockNumber: 0n,
    logIndex: 0,
    timestamp: 0,
    ...over,
  };
}

describe("computeAchievements", () => {
  it("returns 0 earned when the player has no victories", () => {
    const result = computeAchievements([]);
    expect(result.earnedCount).toEqual(0);
    expect(result.total).toBeGreaterThan(0);
    expect(result.list.every((a) => !a.earned)).toBe(true);
  });

  it("handles undefined input (pre-fetch state) gracefully", () => {
    const result = computeAchievements(undefined);
    expect(result.earnedCount).toEqual(0);
    expect(result.list.length).toEqual(result.total);
  });

  it("unlocks first-victory on the very first Victory NFT", () => {
    const result = computeAchievements([victory({})]);
    const first = result.list.find((a) => a.id === "first-victory");
    expect(first?.earned).toBe(true);
  });

  it("unlocks arena-champion-hard only on difficulty 3", () => {
    const easy = computeAchievements([victory({ difficulty: 1 })]);
    expect(easy.list.find((a) => a.id === "arena-champion-hard")?.earned).toBe(false);

    const hard = computeAchievements([victory({ difficulty: 3 })]);
    expect(hard.list.find((a) => a.id === "arena-champion-hard")?.earned).toBe(true);
  });

  it("arena-champion-medium unlocks on difficulty 2 OR 3 (inclusive upward)", () => {
    for (const d of [2, 3]) {
      const result = computeAchievements([victory({ difficulty: d })]);
      expect(result.list.find((a) => a.id === "arena-champion-medium")?.earned).toBe(true);
    }
    const easyOnly = computeAchievements([victory({ difficulty: 1 })]);
    expect(easyOnly.list.find((a) => a.id === "arena-champion-medium")?.earned).toBe(false);
  });

  it("speedrunner unlocks when any victory has ≤20 moves (and > 0)", () => {
    const slow = computeAchievements([victory({ totalMoves: 21 })]);
    expect(slow.list.find((a) => a.id === "speedrunner")?.earned).toBe(false);

    const fast = computeAchievements([victory({ totalMoves: 13 })]);
    expect(fast.list.find((a) => a.id === "speedrunner")?.earned).toBe(true);

    // Zero-move edge case shouldn't unlock
    const zero = computeAchievements([victory({ totalMoves: 0 })]);
    expect(zero.list.find((a) => a.id === "speedrunner")?.earned).toBe(false);
  });

  it("rapid-finish unlocks when any victory finishes in ≤30s", () => {
    const slow = computeAchievements([victory({ timeMs: 45_000 })]);
    expect(slow.list.find((a) => a.id === "rapid-finish")?.earned).toBe(false);

    const fast = computeAchievements([victory({ timeMs: 18_000 })]);
    expect(fast.list.find((a) => a.id === "rapid-finish")?.earned).toBe(true);
  });

  it("five-crowns tracks progress until it unlocks at 5 victories", () => {
    const three = computeAchievements(Array.from({ length: 3 }, () => victory({})));
    const fiveCrowns = three.list.find((a) => a.id === "five-crowns");
    expect(fiveCrowns?.earned).toBe(false);
    expect(fiveCrowns?.progress).toEqual({ current: 3, goal: 5 });

    const five = computeAchievements(Array.from({ length: 5 }, () => victory({})));
    expect(five.list.find((a) => a.id === "five-crowns")?.earned).toBe(true);
    expect(five.list.find((a) => a.id === "five-crowns")?.progress).toBeUndefined();
  });

  it("aggregates earnedCount correctly", () => {
    // 1 hard win in 15 moves in 20s = first-victory + champion-hard + champion-medium + speedrunner + rapid-finish
    const result = computeAchievements([
      victory({ difficulty: 3, totalMoves: 15, timeMs: 20_000 }),
    ]);
    expect(result.earnedCount).toEqual(5);
  });
});
