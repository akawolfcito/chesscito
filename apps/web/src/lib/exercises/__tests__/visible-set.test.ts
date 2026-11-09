import { describe, expect, it } from "vitest";
import { EXERCISES } from "@/lib/game/exercises";
import type { ExerciseCatalog } from "@/lib/game/rotation";
import { computeVisibleExerciseIds } from "@/lib/exercises/visible-set";

const DATE = "2026-06-08";
const firstFive = (piece: Parameters<typeof computeVisibleExerciseIds>[0]["piece"]) =>
  EXERCISES[piece].slice(0, 5).map((e) => e.id);

describe("computeVisibleExerciseIds", () => {
  it("returns null when rotation is disabled (legacy: no filtering)", () => {
    const result = computeVisibleExerciseIds({
      piece: "rook",
      enabled: false,
      address: "0xABC",
      sessionSeed: null,
      dateUtc: DATE,
      starsById: {},
    });
    expect(result).toBeNull();
  });

  it("returns the canonical 5 for a guest with no wallet and no session seed", () => {
    const result = computeVisibleExerciseIds({
      piece: "rook",
      enabled: true,
      address: null,
      sessionSeed: null,
      dateUtc: DATE,
      starsById: {},
    });
    expect(result).not.toBeNull();
    expect([...result!].sort()).toEqual(firstFive("rook").sort());
  });

  it("returns a rotation set (≤5, deterministic) for a connected wallet", () => {
    const opts = {
      piece: "rook" as const,
      enabled: true,
      address: "0xWALLET",
      sessionSeed: null,
      dateUtc: DATE,
      starsById: {},
    };
    const a = computeVisibleExerciseIds(opts);
    const b = computeVisibleExerciseIds(opts);
    expect(a!.size).toBeLessThanOrEqual(5);
    expect(a!.size).toBeGreaterThan(0);
    expect([...a!].sort()).toEqual([...b!].sort()); // deterministic
    // 0★ → only Easy ids surface.
    const easyIds = new Set(
      EXERCISES.rook.filter((e) => e.tier === "easy").map((e) => e.id),
    );
    for (const id of a!) expect(easyIds.has(id)).toBe(true);
  });

  it("uses the guest session_uuid as the seed when present", () => {
    const result = computeVisibleExerciseIds({
      piece: "bishop",
      enabled: true,
      address: null,
      sessionSeed: "session_8f3a-guest-uuid",
      dateUtc: DATE,
      starsById: {},
    });
    expect(result).not.toBeNull();
    expect(result!.size).toBeLessThanOrEqual(5);
    expect(result!.size).toBeGreaterThan(0);
  });

  // ── Phase 2b-2: catalog injection seam ──────────────────────────
  it("computes the visible set against the injected catalog", () => {
    // Single-exercise rook pool → the guest canonical set holds exactly
    // that one id, not the baseline first-five.
    const injected: ExerciseCatalog = {
      ...EXERCISES,
      rook: [EXERCISES.rook[0]],
    };
    const result = computeVisibleExerciseIds(
      {
        piece: "rook",
        enabled: true,
        address: null,
        sessionSeed: null,
        dateUtc: DATE,
        starsById: {},
      },
      injected,
    );
    expect([...result!]).toEqual([EXERCISES.rook[0].id]);
  });
});
