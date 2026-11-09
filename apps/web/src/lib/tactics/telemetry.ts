import { track } from "@/lib/telemetry";

type PuzzleContext = {
  puzzleId: string;
  piece: string;
};

export function emitPlayTacticsOpened(
  context: PuzzleContext & { completedToday: boolean },
): void {
  track("play_tactics_opened", context);
}

export function emitPlayTacticsCompleted(
  context: PuzzleContext & { movesUsed: number; totalCompleted: number },
): void {
  track("play_tactics_completed", context);
}

export function emitPlayTacticsFailed(
  context: PuzzleContext & { movesUsed: number },
): void {
  track("play_tactics_failed", context);
}
