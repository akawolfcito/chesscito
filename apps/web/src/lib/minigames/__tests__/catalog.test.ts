import { describe, expect, it } from "vitest";

import {
  MINIGAME_ENGINES,
  earlyAccessEngines,
  engineChallenges,
  getEngine,
  isEarlyAccessChallenge,
  resolveChallenge,
} from "@/lib/minigames/catalog";
import { baselineMiniGamePools } from "@/lib/minigames/pools";
import type { PieceId } from "@/lib/game/types";

const pools = baselineMiniGamePools();

describe("MINIGAME_ENGINES — the engine registry", () => {
  it("declares exactly one engine per playable piece", () => {
    const pieces = MINIGAME_ENGINES.map((engine) => engine.piece);
    expect(new Set(pieces).size).toBe(pieces.length);
    expect(new Set(pieces)).toEqual(
      new Set<PieceId>(["rook", "bishop", "knight", "pawn", "queen", "king"]),
    );
  });

  it("keeps engine ids unique and stable (they are telemetry `game_id`)", () => {
    const ids = MINIGAME_ENGINES.map((engine) => engine.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toContain("rook-rail");
    expect(ids).toContain("pivot-run");
    expect(ids).toContain("n-queens");
    expect(ids).toContain("safe-path");
  });

  /** AC-9. Knight's Tour: 34 → 1 → 2 accounts across its three levels with the
   *  gate open, and it is `starless` so a completed card has no score to show.
   *  Promotion Run: 13 → 6 → 1, and its own source says optimalMoves grades
   *  nothing. Both are COMING SOON and must stay out of Early Access. */
  it("marks knight-tour and promotion-run COMING SOON, the other four early-access", () => {
    expect(getEngine("knight-tour").status).toBe("coming-soon");
    expect(getEngine("promotion-run").status).toBe("coming-soon");
    for (const id of ["rook-rail", "pivot-run", "n-queens", "safe-path"] as const) {
      expect(getEngine(id).status).toBe("early-access");
    }
  });

  it("exposes exactly the four early-access engines", () => {
    expect(earlyAccessEngines().map((engine) => engine.id).sort()).toEqual([
      "n-queens",
      "pivot-run",
      "rook-rail",
      "safe-path",
    ]);
  });
});

describe("engineChallenges — reads the PROJECTED lane, never the raw pool", () => {
  /* ⚠️ These assert WHICH ids the lane holds, never their ORDER. Lane order is
   * authored (`order` in content/labyrinths.json) and the builder may change
   * it; pinning it here would fail the suite on a legitimate content edit. The
   * order that matters to the player is the ROTATION's, which is pinned in
   * rotation.test.ts because it is authored in code. */
  it("gives the rook its four curated rook-rail labyrinths", () => {
    const ids = engineChallenges(pools, "rook-rail").map((c) => c.id);
    expect(new Set(ids)).toEqual(
      new Set([
        "rook-rail-two-turns",
        "rook-rail-dead-end",
        "rook-rail-rook-run",
        "rook-rail-two-roads",
      ]),
    );
  });

  it("gives the bishop its diagonal-run levels, NOT its retired labyrinths", () => {
    const ids = engineChallenges(pools, "pivot-run").map((c) => c.id);
    expect(new Set(ids)).toEqual(
      new Set(["bishop-run-1", "bishop-run-2", "bishop-run-3"]),
    );
    expect(ids).not.toContain("bishop-lab-3");
    expect(ids).not.toContain("bishop-lab-4");
  });

  it("gives the queen and king their signature pools", () => {
    expect(new Set(engineChallenges(pools, "n-queens").map((c) => c.id))).toEqual(
      new Set(["queens-1", "queens-2", "queens-3"]),
    );
    expect(new Set(engineChallenges(pools, "safe-path").map((c) => c.id))).toEqual(
      new Set(["king-safe-1", "king-safe-2", "king-safe-3"]),
    );
  });

  it("preserves the lane's authored order rather than re-sorting it", () => {
    const projected = engineChallenges(pools, "rook-rail").map((c) => c.id);
    expect(projected).toEqual(pools.labyrinths.rook.map((entry) => entry.id));
  });

  /** The guard that catches a projection change: if someone adds a signature
   *  pool for the rook, `engineChallenges("rook-rail")` silently starts
   *  returning a different game while every id-based test still passes. */
  it("every projected challenge belongs to the pool its engine declares", () => {
    for (const engine of MINIGAME_ENGINES) {
      const declared = new Set(
        pools[engine.pool][engine.piece].map((entry) => entry.id),
      );
      for (const challenge of engineChallenges(pools, engine.id)) {
        expect(declared.has(challenge.id)).toBe(true);
      }
    }
  });
});

describe("resolveChallenge — the canonical lookup across ALL lanes", () => {
  it.each([
    ["rook-rail-two-roads", "rook-rail", "rook"],
    ["bishop-run-2", "pivot-run", "bishop"],
    ["queens-1", "n-queens", "queen"],
    ["king-safe-3", "safe-path", "king"],
    ["knight-tour-1", "knight-tour", "knight"],
    ["pawn-promotion-1", "promotion-run", "pawn"],
  ])("resolves %s to engine %s on the %s", (id, engineId, piece) => {
    const resolved = resolveChallenge(pools, id);
    expect(resolved).not.toBeNull();
    expect(resolved!.engine.id).toBe(engineId);
    expect(resolved!.piece).toBe(piece);
    expect(resolved!.challenge.id).toBe(id);
  });

  /** AC-8. A retired id still exists in `pools.labyrinths` but has been
   *  projected OUT of its piece's lane. It must resolve to null, not to a
   *  playable challenge — this is what keeps retired content out of rotation
   *  and out of deep links for free. */
  it.each(["bishop-lab-3", "knight-lab-1", "queen-lab-2", "pawn-lab-1", "king-lab-1"])(
    "refuses the retired id %s",
    (id) => {
      expect(resolveChallenge(pools, id)).toBeNull();
    },
  );

  it("refuses an unknown id and a lane-1 exercise id", () => {
    expect(resolveChallenge(pools, "no-such-challenge")).toBeNull();
    const firstExercise = pools.exercises.rook[0];
    expect(resolveChallenge(pools, firstExercise.id)).toBeNull();
  });
});

describe("isEarlyAccessChallenge", () => {
  it("accepts the four launch engines and refuses the two coming-soon ones", () => {
    expect(isEarlyAccessChallenge(pools, "rook-rail-two-turns")).toBe(true);
    expect(isEarlyAccessChallenge(pools, "bishop-run-1")).toBe(true);
    expect(isEarlyAccessChallenge(pools, "queens-2")).toBe(true);
    expect(isEarlyAccessChallenge(pools, "king-safe-1")).toBe(true);
    expect(isEarlyAccessChallenge(pools, "knight-tour-1")).toBe(false);
    expect(isEarlyAccessChallenge(pools, "pawn-promotion-1")).toBe(false);
    expect(isEarlyAccessChallenge(pools, "bishop-lab-3")).toBe(false);
  });
});
