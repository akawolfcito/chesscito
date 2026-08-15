import { describe, it, expect } from "vitest";

import { outcomeCopyKey } from "../outcome-copy";
import type { DuelOutcome } from "../types";

describe("outcomeCopyKey", () => {
  /**
   * ⛔ THE FAILURE THIS GUARDS AGAINST: telling the loser they won. The outcome
   * names a winner in absolute terms, so turning it into "you" needs the seat
   * of whoever is reading. Both sides of every decisive ending are asserted.
   */
  it("reads the same ending differently on each side of the board", () => {
    const cases: Array<[DuelOutcome, string, string]> = [
      [{ kind: "checkmate", winner: "w" }, "wonCheckmate", "lostCheckmate"],
      [{ kind: "resign", winner: "w" }, "wonResign", "lostResign"],
      [{ kind: "timeout", winner: "w" }, "wonTimeout", "lostTimeout"],
    ];

    for (const [outcome, forWinner, forLoser] of cases) {
      expect(outcomeCopyKey(outcome, "w")).toBe(forWinner);
      expect(outcomeCopyKey(outcome, "b")).toBe(forLoser);
    }
  });

  it("follows the winner when it is the other seat", () => {
    expect(outcomeCopyKey({ kind: "timeout", winner: "b" }, "b")).toBe("wonTimeout");
    expect(outcomeCopyKey({ kind: "timeout", winner: "b" }, "w")).toBe("lostTimeout");
  });

  it("names each of the four draws by its reason", () => {
    expect(outcomeCopyKey({ kind: "draw", reason: "stalemate" }, "w")).toBe("drawStalemate");
    expect(outcomeCopyKey({ kind: "draw", reason: "insufficient-material" }, "w")).toBe(
      "drawInsufficient",
    );
    expect(outcomeCopyKey({ kind: "draw", reason: "threefold-repetition" }, "w")).toBe(
      "drawRepetition",
    );
    expect(outcomeCopyKey({ kind: "draw", reason: "fifty-move" }, "w")).toBe("drawFiftyMove");
  });

  /** ⚠️ A draw is a draw for everyone, including somebody with no seat. */
  it("gives a spectator the draw too", () => {
    expect(outcomeCopyKey({ kind: "draw", reason: "stalemate" }, null)).toBe("drawStalemate");
  });

  /**
   * ⛔ A spectator holds no seat, so there is no "you" to address. Inventing a
   * side would be a lie about a game they are not in.
   */
  it("never tells a spectator they won or lost", () => {
    for (const outcome of [
      { kind: "checkmate", winner: "w" },
      { kind: "resign", winner: "b" },
      { kind: "timeout", winner: "w" },
    ] as DuelOutcome[]) {
      expect(outcomeCopyKey(outcome, null)).toBe("endedNeutral");
    }
  });

  it("falls back to neutral when there is no outcome at all", () => {
    expect(outcomeCopyKey(null, "w")).toBe("endedNeutral");
  });
});
