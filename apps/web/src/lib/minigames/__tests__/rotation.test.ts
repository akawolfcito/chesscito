import { describe, expect, it } from "vitest";

import {
  ACTIVE_ROTATION_ID,
  MINIGAME_ROTATIONS,
  ROTATION_SIZE,
  carriedOverIds,
  getActiveRotation,
  getRotation,
  isRotationComplete,
  resolveRotation,
  validateRotation,
} from "@/lib/minigames/rotation";
import { baselineMiniGamePools } from "@/lib/minigames/pools";
import { resolveChallenge } from "@/lib/minigames/catalog";

const pools = baselineMiniGamePools();

describe("MINIGAME_ROTATIONS — the versioned source of truth", () => {
  it("has unique rotation ids", () => {
    const ids = MINIGAME_ROTATIONS.map((rotation) => rotation.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("names an active rotation that exists", () => {
    expect(getRotation(ACTIVE_ROTATION_ID)).toBeDefined();
    expect(getActiveRotation().id).toBe(ACTIVE_ROTATION_ID);
  });

  /** AC-10 / build guard. Every shipped rotation must validate against the
   *  canonical catalog. A typo'd or retired id fails the suite, never a
   *  player's screen. */
  it("every shipped rotation validates clean against the canonical catalog", () => {
    for (const rotation of MINIGAME_ROTATIONS) {
      expect(validateRotation(rotation, pools)).toEqual([]);
    }
  });

  it("every shipped rotation holds exactly ROTATION_SIZE challenges", () => {
    for (const rotation of MINIGAME_ROTATIONS) {
      expect(rotation.items).toHaveLength(ROTATION_SIZE);
    }
  });

  /** Content-variety rule: one engine may not appear twice inside a single
   *  rotation. Three levels of Rook Rail is not a rotation, it is Rook Rail. */
  it("never features the same engine twice inside one rotation", () => {
    for (const rotation of MINIGAME_ROTATIONS) {
      const engines = rotation.items.map(
        (id) => resolveChallenge(pools, id)!.engine.id,
      );
      expect(new Set(engines).size).toBe(engines.length);
    }
  });

  /** Capacity: 13 healthy challenges across 4 engines. The shipped rotations
   *  must not burn a level twice before the catalog is exhausted, or the
   *  "featured" surface repeats itself while unseen content sits idle. */
  it("never repeats a challenge across the shipped rotations", () => {
    const all = MINIGAME_ROTATIONS.flatMap((rotation) => [...rotation.items]);
    expect(new Set(all).size).toBe(all.length);
  });
});

describe("validateRotation", () => {
  it("rejects an unknown challenge id", () => {
    const issues = validateRotation(
      { id: "t", items: ["rook-rail-two-turns", "nope-1", "queens-1"] },
      pools,
    );
    expect(issues).toContainEqual({ code: "unknown_challenge", id: "nope-1" });
  });

  it("rejects a duplicate challenge id", () => {
    const issues = validateRotation(
      { id: "t", items: ["queens-1", "queens-1", "rook-rail-two-turns"] },
      pools,
    );
    expect(issues).toContainEqual({ code: "duplicate_challenge", id: "queens-1" });
  });

  /** AC-9. Coming Soon content must be unable to enter rotation. */
  it.each(["knight-tour-1", "pawn-promotion-1"])(
    "rejects the coming-soon challenge %s",
    (id) => {
      const issues = validateRotation({ id: "t", items: [id] }, pools);
      expect(issues.some((issue) => issue.code === "coming_soon_engine")).toBe(true);
    },
  );

  /** AC-8. A retired id resolves to nothing, so it reports as unknown — the
   *  same refusal, reached without a second list to keep in sync. */
  it("rejects a retired id", () => {
    const issues = validateRotation({ id: "t", items: ["bishop-lab-3"] }, pools);
    expect(issues).toContainEqual({
      code: "unknown_challenge",
      id: "bishop-lab-3",
    });
  });

  it("rejects an empty rotation", () => {
    expect(validateRotation({ id: "t", items: [] }, pools)).toEqual([
      { code: "empty_rotation" },
    ]);
  });

  it("accepts a well-formed rotation", () => {
    expect(
      validateRotation(
        { id: "t", items: ["rook-rail-two-roads", "bishop-run-2", "queens-1"] },
        pools,
      ),
    ).toEqual([]);
  });
});

describe("resolveRotation", () => {
  it("preserves the authored order and carries engine + piece", () => {
    const featured = resolveRotation(
      { id: "t", items: ["queens-1", "rook-rail-two-roads", "bishop-run-2"] },
      pools,
    );
    expect(featured.map((entry) => entry.challengeId)).toEqual([
      "queens-1",
      "rook-rail-two-roads",
      "bishop-run-2",
    ]);
    expect(featured.map((entry) => entry.engineId)).toEqual([
      "n-queens",
      "rook-rail",
      "pivot-run",
    ]);
    expect(featured.map((entry) => entry.piece)).toEqual(["queen", "rook", "bishop"]);
  });

  /** A rotation that somehow ships an invalid id must DROP it, never render a
   *  card that routes nowhere. Validation is the build-time guard; this is the
   *  runtime floor under it. */
  it("drops ids it cannot resolve instead of rendering a dead card", () => {
    const featured = resolveRotation(
      { id: "t", items: ["queens-1", "nope-1", "bishop-lab-3"] },
      pools,
    );
    expect(featured.map((entry) => entry.challengeId)).toEqual(["queens-1"]);
  });
});

describe("carriedOverIds — content freshness without any storage", () => {
  it("returns nothing for the first rotation", () => {
    expect(carriedOverIds(MINIGAME_ROTATIONS[0].id)).toEqual(new Set());
  });

  it("returns the ids the previous rotation also featured", () => {
    const second = MINIGAME_ROTATIONS[1];
    const first = MINIGAME_ROTATIONS[0];
    const carried = carriedOverIds(second.id);
    for (const id of second.items) {
      expect(carried.has(id)).toBe(first.items.includes(id));
    }
  });

  it("returns nothing for an unknown rotation id", () => {
    expect(carriedOverIds("no-such-rotation")).toEqual(new Set());
  });
});

describe("isRotationComplete", () => {
  const featured = resolveRotation(getActiveRotation(), pools);

  it("is false when nothing is completed", () => {
    expect(isRotationComplete(featured, {})).toBe(false);
  });

  it("is false when some are completed", () => {
    const partial = { [featured[0].piece]: { [featured[0].challengeId]: 4 } };
    expect(isRotationComplete(featured, partial)).toBe(false);
  });

  it("is true only when every featured challenge has a recorded best", () => {
    const all: Record<string, Record<string, number>> = {};
    for (const entry of featured) {
      all[entry.piece] = { ...(all[entry.piece] ?? {}), [entry.challengeId]: 4 };
    }
    expect(isRotationComplete(featured, all)).toBe(true);
  });

  it("is false for an empty featured list — vacuous truth is never a completion", () => {
    expect(isRotationComplete([], {})).toBe(false);
  });
});
