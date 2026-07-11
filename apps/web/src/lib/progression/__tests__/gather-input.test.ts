import { describe, expect, it } from "vitest";
import { gatherMilestoneInput } from "@/lib/progression/gather-input";
import type { PieceProgress } from "@/lib/game/types";

const rook: PieceProgress = {
  piece: "rook",
  currentId: null,
  stars: { "rook-1": 3, "rook-2": 2, "rook-3": 0 },
};

const bishop: PieceProgress = {
  piece: "bishop",
  currentId: null,
  stars: { "bishop-1": 1 },
};

describe("gatherMilestoneInput", () => {
  it("sums lifetime stars across every piece", () => {
    const input = gatherMilestoneInput({
      piece: "rook",
      progressByPiece: { rook, bishop },
      dailyStars: 0,
      sessionQuotaExhausted: false,
      badgeClaimed: false,
      allLabyrinthsComplete: false,
      hadGreatSessionBefore: false,
    });
    expect(input.lifetimeStars).toBe(6);
  });

  it("counts only exercises solved at least once — a 0-star entry is not completed", () => {
    const input = gatherMilestoneInput({
      piece: "rook",
      progressByPiece: { rook, bishop },
      dailyStars: 0,
      sessionQuotaExhausted: false,
      badgeClaimed: false,
      allLabyrinthsComplete: false,
      hadGreatSessionBefore: false,
    });
    expect(input.completedExercises).toBe(3);
    expect(input.pieceCompletedExercises).toBe(2);
  });

  it("scopes piece stars to the piece under play and exposes rook stars separately", () => {
    const input = gatherMilestoneInput({
      piece: "bishop",
      progressByPiece: { rook, bishop },
      dailyStars: 0,
      sessionQuotaExhausted: false,
      badgeClaimed: false,
      allLabyrinthsComplete: false,
      hadGreatSessionBefore: false,
    });
    expect(input.pieceStars).toBe(1);
    expect(input.rookStars).toBe(5);
  });
});
