import { describe, it, expect } from "vitest";

import { duelEndSummary, duelEndTone } from "../end-summary";
import { toPublic } from "../lifecycle";
import { createDuel, joinDuel, playMove, resignDuel } from "../operations";
import { hashSeatToken } from "../seat-token";
import type { DuelOutcome, DuelPublic } from "../types";

const NOON = Date.parse("2026-08-15T12:00:00.000Z");

function game() {
  const joined = joinDuel({
    duel: createDuel({
      id: "A".repeat(22),
      seat: "w",
      tokenHash: hashSeatToken("white"),
      minutes: 10,
      displayName: "Ana",
      invitedBy: null,
      now: NOON,
    }),
    tokenHash: hashSeatToken("black"),
    displayName: "Beto",
    presentedToken: null,
    now: NOON,
  });
  if (!joined.ok) throw new Error("fixture");
  return joined.duel;
}

describe("duelEndTone", () => {
  /**
   * ⛔ THE FAILURE THIS EXISTS TO STOP: a loss dressed as a celebration. The
   * outcome names a winner in absolute terms; the tone needs to know who reads.
   */
  it("reads the same ending as a win on one side and a loss on the other", () => {
    const outcomes: DuelOutcome[] = [
      { kind: "checkmate", winner: "w" },
      { kind: "resign", winner: "w" },
      { kind: "timeout", winner: "w" },
    ];

    for (const outcome of outcomes) {
      expect(duelEndTone(outcome, "w")).toBe("win");
      expect(duelEndTone(outcome, "b")).toBe("loss");
    }
  });

  it("calls a draw a draw for everyone", () => {
    const draw: DuelOutcome = { kind: "draw", reason: "stalemate" };

    expect(duelEndTone(draw, "w")).toBe("draw");
    expect(duelEndTone(draw, "b")).toBe("draw");
    expect(duelEndTone(draw, null)).toBe("draw");
  });

  /** ⚠️ A spectator did not win or lose anything. */
  it("stays neutral for somebody with no seat", () => {
    expect(duelEndTone({ kind: "checkmate", winner: "w" }, null)).toBe("neutral");
    expect(duelEndTone(null, "w")).toBe("neutral");
  });
});

describe("duelEndSummary", () => {
  it("counts moves the way a chess player does, in pairs", () => {
    let duel = game();
    for (const [san, token, version] of [
      ["e4", "white", 2],
      ["e5", "black", 3],
      ["Nf3", "white", 4],
    ] as Array<[string, string, number]>) {
      const played = playMove({ duel, token, san, version, now: NOON + version * 1000 });
      if (!played.ok) throw new Error(`fixture: ${JSON.stringify(played)}`);
      duel = played.duel;
    }

    // 3 plies: white has played twice, black once — that is move 2.
    expect(duelEndSummary(toPublic(duel, "w"), "w").moves).toBe(2);
  });

  it("measures how long the game ran", () => {
    const played = playMove({
      duel: game(),
      token: "white",
      san: "e4",
      version: 2,
      now: NOON + 45_000,
    });
    if (!played.ok) throw new Error("fixture");

    expect(duelEndSummary(toPublic(played.duel, "w"), "w").elapsedMs).toBe(45_000);
  });

  /**
   * ⚠️ `null`, not zero. An invitation nobody answered has no duration, and a
   * screen reading "0s" would describe a game that ended instantly — which is
   * a different and much stranger story than "nobody came".
   */
  it("reports no duration at all for a game that never started", () => {
    const invitation = createDuel({
      id: "A".repeat(22),
      seat: "w",
      tokenHash: hashSeatToken("white"),
      minutes: 10,
      displayName: null,
      invitedBy: null,
      now: NOON,
    });

    expect(duelEndSummary(toPublic(invitation, "w"), "w").elapsedMs).toBeNull();
  });

  it("carries the tone of whoever is reading", () => {
    const finished = resignDuel({ duel: game(), token: "white", version: 2, now: NOON });
    if (!finished.ok) throw new Error("fixture");
    const duel: DuelPublic = toPublic(finished.duel, "w");

    expect(duelEndSummary(duel, "w").tone).toBe("loss");
    expect(duelEndSummary(toPublic(finished.duel, "b"), "b").tone).toBe("win");
  });
});
