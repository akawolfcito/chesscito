import type { BasicCoachResponse, GameResult } from "./types";

type QuickReviewInput = {
  result: GameResult;
  difficulty: string;
  totalMoves: number;
  elapsedMs: number;
};

export function generateQuickReview(input: QuickReviewInput): BasicCoachResponse {
  const { result, difficulty, totalMoves, elapsedMs } = input;
  const seconds = Math.floor(elapsedMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const timeStr = minutes > 0 ? `${minutes}m ${seconds % 60}s` : `${seconds}s`;

  const summary = buildSummary(result, difficulty, totalMoves, timeStr);
  const tips = buildTips(result, difficulty, totalMoves);

  return { kind: "quick", summary, tips };
}

function buildSummary(result: GameResult, difficulty: string, moves: number, time: string): string {
  switch (result) {
    case "win":
      return `You won in ${moves} moves on ${difficulty} difficulty (${time}). Solid game.`;
    case "lose":
      return `You lost after ${moves} moves on ${difficulty} (${time}). Every loss is a learning opportunity.`;
    case "draw":
      return `Draw after ${moves} moves on ${difficulty} (${time}). A closely fought game.`;
    case "resigned":
      return `You resigned after ${moves} moves on ${difficulty} (${time}). Knowing when to reset is part of the game.`;
  }
}

function buildTips(result: GameResult, difficulty: string, moves: number): string[] {
  const tips: string[] = [];

  if (result === "win" && difficulty === "easy") {
    tips.push("Try medium difficulty for a bigger challenge");
  }
  if (result === "win" && difficulty === "medium") {
    tips.push("Ready for hard? The AI plays to win at that level");
  }
  if (result === "win" && moves <= 10) {
    tips.push("Winning in under 10 moves signals strong tactical play");
  }
  if (result === "win" && moves > 30) {
    tips.push("Long games test endgame skills — keep practicing those");
  }
  if (result === "lose") {
    tips.push("Review the moment where the game turned — what would you do differently?");
  }
  if (result === "lose" && difficulty === "hard") {
    tips.push("Hard difficulty is a real challenge — try medium to build confidence");
  }
  if (result === "resigned") {
    tips.push("Before resigning, look for defensive moves — you might find a way out");
  }
  if (result === "draw") {
    tips.push("Draws often come from missed opportunities — look for moments to press advantage");
  }

  if (tips.length === 0) {
    tips.push("Keep playing to improve your pattern recognition");
  }

  return tips.slice(0, 3);
}
