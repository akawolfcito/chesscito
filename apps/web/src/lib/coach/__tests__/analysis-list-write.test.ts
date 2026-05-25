import { describe, it, expect } from "vitest";
import { ANALYSIS_LIST_LPUSH_LUA } from "../analysis-list-write";

describe("ANALYSIS_LIST_LPUSH_LUA — atomic LPOS-then-LPUSH script", () => {
  it("exports a non-empty Lua string", () => {
    expect(typeof ANALYSIS_LIST_LPUSH_LUA).toBe("string");
    expect(ANALYSIS_LIST_LPUSH_LUA.trim().length).toBeGreaterThan(0);
  });

  it("uses LPOS to guard the LPUSH on KEYS[1] with ARGV[1]", () => {
    expect(ANALYSIS_LIST_LPUSH_LUA).toMatch(/LPOS.*KEYS\[1\].*ARGV\[1\]/);
    expect(ANALYSIS_LIST_LPUSH_LUA).toMatch(/LPUSH.*KEYS\[1\].*ARGV\[1\]/);
  });

  it("short-circuits with `return 0` when the gameId already exists", () => {
    expect(ANALYSIS_LIST_LPUSH_LUA).toMatch(/return 0/);
    expect(ANALYSIS_LIST_LPUSH_LUA).toMatch(/return 1/);
  });

  it("mirrors the GAME_LIST_LPUSH_LUA contract (same single-line shape)", () => {
    // Both scripts are paired by intent — keep the textual shape in
    // sync so a future maintainer can grep both together. If this test
    // breaks, audit `game-persistence.ts` to confirm the divergence is
    // deliberate.
    const condensed = ANALYSIS_LIST_LPUSH_LUA.replace(/\s+/g, " ").trim();
    expect(condensed).toBe(
      "if redis.call('LPOS', KEYS[1], ARGV[1]) then return 0 end redis.call('LPUSH', KEYS[1], ARGV[1]) return 1",
    );
  });
});
