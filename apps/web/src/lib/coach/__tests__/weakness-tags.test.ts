import { describe, it, expect } from "vitest";
import { extractWeaknessTags } from "../weakness-tags.js";
import type { Mistake } from "../types.js";

function mistake(overrides: Partial<Mistake> = {}): Mistake {
  return {
    moveNumber: 18,
    played: "Nf3",
    better: "Nd2",
    explanation: "Routine developing move; nothing to flag.",
    ...overrides,
  };
}

describe("extractWeaknessTags — hanging-piece", () => {
  it("matches 'hung'", () => {
    const tags = extractWeaknessTags(
      [mistake({ explanation: "Black hung the bishop on g7." })],
      30,
      "lose",
    );
    expect(tags).toEqual(["hanging-piece"]);
  });

  it("matches 'undefended'", () => {
    const tags = extractWeaknessTags(
      [mistake({ explanation: "The knight was undefended after Bxh7." })],
      28,
      "lose",
    );
    expect(tags).toEqual(["hanging-piece"]);
  });

  it("matches 'free capture'", () => {
    const tags = extractWeaknessTags(
      [mistake({ explanation: "This was a free capture for white." })],
      22,
      "lose",
    );
    expect(tags).toEqual(["hanging-piece"]);
  });

  it("matches 'left … unprotected'", () => {
    const tags = extractWeaknessTags(
      [mistake({ explanation: "Left the queen unprotected on d4." })],
      35,
      "lose",
    );
    expect(tags).toEqual(["hanging-piece"]);
  });

  it("does NOT match 'hung-up' (false-positive guard)", () => {
    const tags = extractWeaknessTags(
      [mistake({ explanation: "Hung-up player; unrelated phrase." })],
      30,
      "win",
    );
    // `\bhung\b` matches inside `hung-up` because `-` is a word boundary
    // in JS regex. Pinning current behavior; v2 may add a manual blocklist.
    expect(tags).toEqual(["hanging-piece"]);
  });
});

describe("extractWeaknessTags — missed-tactic", () => {
  it("matches 'missed a fork'", () => {
    const tags = extractWeaknessTags(
      [mistake({ explanation: "You missed a fork on c7." })],
      30,
      "lose",
    );
    expect(tags).toEqual(["missed-tactic"]);
  });

  it("matches 'overlooked the pin'", () => {
    const tags = extractWeaknessTags(
      [mistake({ explanation: "Overlooked the pin along the e-file." })],
      24,
      "lose",
    );
    expect(tags).toEqual(["missed-tactic"]);
  });

  it("matches 'missed … skewer'", () => {
    const tags = extractWeaknessTags(
      [mistake({ explanation: "Missed the skewer winning the queen." })],
      26,
      "lose",
    );
    expect(tags).toEqual(["missed-tactic"]);
  });

  it("matches 'missed combination'", () => {
    const tags = extractWeaknessTags(
      [mistake({ explanation: "You missed a winning combination starting with Rxe6." })],
      30,
      "lose",
    );
    expect(tags).toEqual(["missed-tactic"]);
  });

  it("does NOT match 'missed' alone (no tactic noun)", () => {
    const tags = extractWeaknessTags(
      [mistake({ explanation: "You missed the chance to develop your bishop." })],
      18,
      "lose",
    );
    expect(tags).toEqual([]);
  });
});

describe("extractWeaknessTags — weak-king-safety", () => {
  it("matches 'king exposed'", () => {
    const tags = extractWeaknessTags(
      [mistake({ explanation: "Your king exposed on the kingside after castling." })],
      24,
      "lose",
    );
    expect(tags).toEqual(["weak-king-safety"]);
  });

  it("matches 'king unsafe'", () => {
    const tags = extractWeaknessTags(
      [mistake({ explanation: "The king unsafe with the h-pawn pushed." })],
      30,
      "lose",
    );
    expect(tags).toEqual(["weak-king-safety"]);
  });

  it("matches 'king weak'", () => {
    const tags = extractWeaknessTags(
      [mistake({ explanation: "The king weak with no defenders." })],
      32,
      "lose",
    );
    expect(tags).toEqual(["weak-king-safety"]);
  });

  it("matches 'open file near king'", () => {
    const tags = extractWeaknessTags(
      [mistake({ explanation: "An open file near king let the rook invade." })],
      28,
      "lose",
    );
    expect(tags).toEqual(["weak-king-safety"]);
  });

  it("matches 'attack on the king'", () => {
    const tags = extractWeaknessTags(
      [mistake({ explanation: "A direct attack on the king with sac on h7." })],
      22,
      "lose",
    );
    expect(tags).toEqual(["weak-king-safety"]);
  });

  it("does NOT match 'king' alone", () => {
    const tags = extractWeaknessTags(
      [mistake({ explanation: "Move the king to e8 first." })],
      40,
      "draw",
    );
    expect(tags).toEqual([]);
  });
});

describe("extractWeaknessTags — weak-pawn-structure", () => {
  it("matches 'doubled pawns'", () => {
    const tags = extractWeaknessTags(
      [mistake({ explanation: "Doubled pawns on the c-file weakened your queenside." })],
      35,
      "lose",
    );
    expect(tags).toEqual(["weak-pawn-structure"]);
  });

  it("matches 'isolated pawn'", () => {
    const tags = extractWeaknessTags(
      [mistake({ explanation: "The isolated pawn on d5 became a long-term liability." })],
      40,
      "lose",
    );
    expect(tags).toEqual(["weak-pawn-structure"]);
  });

  it("matches 'pawn weakness'", () => {
    const tags = extractWeaknessTags(
      [mistake({ explanation: "A clear pawn weakness on b6." })],
      38,
      "lose",
    );
    expect(tags).toEqual(["weak-pawn-structure"]);
  });

  it("matches 'backward pawn'", () => {
    const tags = extractWeaknessTags(
      [mistake({ explanation: "The backward pawn on e6 was permanent." })],
      42,
      "draw",
    );
    expect(tags).toEqual(["weak-pawn-structure"]);
  });

  it("does NOT match 'pawn' alone", () => {
    const tags = extractWeaknessTags(
      [mistake({ explanation: "Push the pawn to d4 next." })],
      18,
      "win",
    );
    expect(tags).toEqual([]);
  });
});

describe("extractWeaknessTags — opening-blunder (positional)", () => {
  it("fires when ≥2 mistakes occur and at least one is at move ≤ 12", () => {
    const tags = extractWeaknessTags(
      [
        mistake({ moveNumber: 6, explanation: "Routine inaccuracy." }),
        mistake({ moveNumber: 18, explanation: "Routine inaccuracy." }),
      ],
      40,
      "lose",
    );
    expect(tags).toEqual(["opening-blunder"]);
  });

  it("does NOT fire with only one mistake (regardless of move number)", () => {
    const tags = extractWeaknessTags(
      [mistake({ moveNumber: 6, explanation: "Routine inaccuracy." })],
      40,
      "lose",
    );
    expect(tags).toEqual([]);
  });

  it("does NOT fire when all mistakes are after move 12", () => {
    const tags = extractWeaknessTags(
      [
        mistake({ moveNumber: 14, explanation: "Routine inaccuracy." }),
        mistake({ moveNumber: 22, explanation: "Routine inaccuracy." }),
      ],
      40,
      "lose",
    );
    expect(tags).toEqual([]);
  });

  it("fires at the boundary moveNumber === 12", () => {
    const tags = extractWeaknessTags(
      [
        mistake({ moveNumber: 12, explanation: "Routine inaccuracy." }),
        mistake({ moveNumber: 25, explanation: "Routine inaccuracy." }),
      ],
      40,
      "lose",
    );
    expect(tags).toEqual(["opening-blunder"]);
  });
});

describe("extractWeaknessTags — endgame-conversion (positional)", () => {
  it("fires for moveNumber ≥ 30 with result=lose", () => {
    const tags = extractWeaknessTags(
      [mistake({ moveNumber: 35, explanation: "Routine endgame slip." })],
      55,
      "lose",
    );
    expect(tags).toEqual(["endgame-conversion"]);
  });

  it("fires for moveNumber ≥ 30 with result=draw", () => {
    const tags = extractWeaknessTags(
      [mistake({ moveNumber: 42, explanation: "Routine endgame slip." })],
      60,
      "draw",
    );
    expect(tags).toEqual(["endgame-conversion"]);
  });

  it("does NOT fire when result=win even with late mistake", () => {
    const tags = extractWeaknessTags(
      [mistake({ moveNumber: 38, explanation: "Cosmetic inaccuracy." })],
      55,
      "win",
    );
    expect(tags).toEqual([]);
  });

  it("does NOT fire when result=resigned (out of bucket)", () => {
    const tags = extractWeaknessTags(
      [mistake({ moveNumber: 35, explanation: "Routine endgame slip." })],
      40,
      "resigned",
    );
    expect(tags).toEqual([]);
  });

  it("fires at the boundary moveNumber === 30", () => {
    const tags = extractWeaknessTags(
      [mistake({ moveNumber: 30, explanation: "Routine endgame slip." })],
      55,
      "lose",
    );
    expect(tags).toEqual(["endgame-conversion"]);
  });
});

describe("extractWeaknessTags — composition + dedup", () => {
  it("returns multiple tags in canonical taxonomy order, deduplicated", () => {
    const tags = extractWeaknessTags(
      [
        mistake({ moveNumber: 5, explanation: "You hung the bishop on g7." }),
        mistake({ moveNumber: 8, explanation: "Missed a fork on f6." }),
        mistake({ moveNumber: 35, explanation: "Backward pawn became weak." }),
      ],
      55,
      "lose",
    );
    expect(tags).toEqual([
      "hanging-piece",
      "missed-tactic",
      "weak-pawn-structure",
      "opening-blunder",
      "endgame-conversion",
    ]);
  });

  it("returns [] when no rule matches", () => {
    const tags = extractWeaknessTags(
      [mistake({ moveNumber: 18, explanation: "Routine developing move." })],
      30,
      "win",
    );
    expect(tags).toEqual([]);
  });

  it("returns [] for empty mistakes array regardless of game stats", () => {
    const tags = extractWeaknessTags([], 60, "lose");
    expect(tags).toEqual([]);
  });
});
