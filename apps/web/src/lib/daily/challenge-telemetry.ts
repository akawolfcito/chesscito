import { track } from "@/lib/telemetry";

type ChallengeBase = {
  challengeId: string; // "YYYY-MM-DD"
  puzzleId: string;
};

const COMMON = {
  isLite: true,
  source: "challenge_link",
} as const;

export function emitChallengeLinkOpened(
  args: ChallengeBase & { puzzlePiece: string },
): void {
  track("challenge_link_opened", {
    ...COMMON,
    challengeId: args.challengeId,
    puzzleId: args.puzzleId,
    puzzlePiece: args.puzzlePiece,
  });
}

export function emitChallengeStarted(args: ChallengeBase): void {
  track("challenge_started", {
    ...COMMON,
    challengeId: args.challengeId,
    puzzleId: args.puzzleId,
  });
}

export function emitChallengeCompleted(
  args: ChallengeBase & { movesUsed: number },
): void {
  track("challenge_completed", {
    ...COMMON,
    challengeId: args.challengeId,
    puzzleId: args.puzzleId,
    movesUsed: args.movesUsed,
  });
}

export function emitChallengeShared(args: ChallengeBase): void {
  track("challenge_shared", {
    ...COMMON,
    challengeId: args.challengeId,
    puzzleId: args.puzzleId,
  });
}

export function emitChallengeContinueToLite(
  args: Pick<ChallengeBase, "challengeId">,
): void {
  track("challenge_continue_to_lite", {
    ...COMMON,
    challengeId: args.challengeId,
  });
}
