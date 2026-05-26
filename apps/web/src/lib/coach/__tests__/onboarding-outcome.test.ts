import { describe, it, expect } from "vitest";
import { gameStatusToOnboardingOutcome } from "../onboarding-outcome";

describe("gameStatusToOnboardingOutcome", () => {
  it("checkmate + isPlayerWin=true → 'win'", () => {
    expect(gameStatusToOnboardingOutcome("checkmate", true)).toBe("win");
  });

  it("checkmate + isPlayerWin=false → 'lose'", () => {
    expect(gameStatusToOnboardingOutcome("checkmate", false)).toBe("lose");
  });

  it("stalemate → 'draw' regardless of isPlayerWin", () => {
    expect(gameStatusToOnboardingOutcome("stalemate", true)).toBe("draw");
    expect(gameStatusToOnboardingOutcome("stalemate", false)).toBe("draw");
  });

  it("draw → 'draw' regardless of isPlayerWin", () => {
    expect(gameStatusToOnboardingOutcome("draw", true)).toBe("draw");
    expect(gameStatusToOnboardingOutcome("draw", false)).toBe("draw");
  });

  it("resigned → 'lose' (resignation folds into defeat per spec §3)", () => {
    expect(gameStatusToOnboardingOutcome("resigned", true)).toBe("lose");
    expect(gameStatusToOnboardingOutcome("resigned", false)).toBe("lose");
  });

  it("non-terminal 'selecting' defaults to 'lose' (safest empathetic frame)", () => {
    expect(gameStatusToOnboardingOutcome("selecting", false)).toBe("lose");
  });

  it("non-terminal 'playing' defaults to 'lose' (safest empathetic frame)", () => {
    expect(gameStatusToOnboardingOutcome("playing", true)).toBe("lose");
  });
});
