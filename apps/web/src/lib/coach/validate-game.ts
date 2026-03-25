import { Chess } from "chess.js";
import type { GameResult } from "./types";

type ValidationInput = {
  moves: string[];
  result: GameResult;
  difficulty: string;
};

type ValidationResult =
  | { valid: true; computedResult: GameResult; totalMoves: number }
  | { valid: false; error: string };

export function validateGameRecord(input: ValidationInput): ValidationResult {
  if (!input.moves || input.moves.length === 0) {
    return { valid: false, error: "Empty move list" };
  }

  const game = new Chess();

  for (let i = 0; i < input.moves.length; i++) {
    try {
      const moveResult = game.move(input.moves[i]);
      if (!moveResult) {
        return { valid: false, error: `Illegal move at index ${i}: ${input.moves[i]}` };
      }
    } catch {
      return { valid: false, error: `Illegal move at index ${i}: ${input.moves[i]}` };
    }
  }

  let computedResult: GameResult;
  if (game.isCheckmate()) {
    computedResult = game.turn() === "b" ? "win" : "lose";
  } else if (game.isStalemate() || game.isDraw()) {
    computedResult = "draw";
  } else if (input.result === "resigned") {
    if (input.moves.length < 2) {
      return { valid: false, error: "Too few moves to resign" };
    }
    computedResult = "resigned";
  } else {
    // Game still in progress but not resigned — reject
    return { valid: false, error: `Result "${input.result}" does not match board state` };
  }

  return {
    valid: true,
    computedResult,
    totalMoves: input.moves.length,
  };
}
