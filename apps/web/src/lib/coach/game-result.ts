import type { GameResult } from "./types";

export function mapArenaResult(status: string, isPlayerWin: boolean): GameResult {
  switch (status) {
    case "checkmate":
      return isPlayerWin ? "win" : "lose";
    case "stalemate":
    case "draw":
      return "draw";
    case "resigned":
      return "resigned";
    default:
      return "lose";
  }
}
