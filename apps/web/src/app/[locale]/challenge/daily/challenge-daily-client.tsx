"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { DailyTacticSheet } from "@/components/daily/daily-tactic-sheet";
import { recordDailyCompletion } from "@/lib/daily/progress";
import { dispatchDailyProgressChanged } from "@/lib/daily/events";
import {
  emitChallengeLinkOpened,
  emitChallengeStarted,
  emitChallengeCompleted,
  emitChallengeContinueToLite,
} from "@/lib/daily/challenge-telemetry";
import { getShareOrigin } from "@/lib/og/share-urls";
import { posToString } from "@/lib/game/notation";
import type { DailyTacticData } from "@/lib/daily/daily-puzzles";

type Props = {
  puzzleData: DailyTacticData;
  today: string;
};

function buildOgCardUrl(
  origin: string,
  puzzleData: DailyTacticData,
  streak?: number,
  solved?: boolean,
): string {
  const params = new URLSearchParams({
    type: "daily",
    piece: puzzleData.piece,
    name: puzzleData.name,
    start: posToString(puzzleData.exercise.startPos),
    target: posToString(puzzleData.exercise.targetPos),
  });
  if (solved) {
    params.set("solved", "true");
    if (streak && streak > 0) params.set("streak", String(streak));
  }
  return `${origin}/api/og/exercise?${params.toString()}`;
}

export function ChallengeDailyClient({ puzzleData, today }: Props) {
  const router = useRouter();
  const [solveStreak, setSolveStreak] = useState(0);
  const hasStartedRef = useRef(false);

  const origin = getShareOrigin();
  const challengeUrl = `${origin}/challenge/daily?date=${today}`;
  const ogCardUrl = buildOgCardUrl(origin, puzzleData);
  const ogCardSolvedUrl = buildOgCardUrl(origin, puzzleData, solveStreak, true);

  useEffect(() => {
    emitChallengeLinkOpened({
      challengeId: today,
      puzzleId: puzzleData.id,
      puzzlePiece: puzzleData.piece,
    });
  }, [today, puzzleData.id, puzzleData.piece]);

  function handleSolve(movesUsed: number) {
    if (!hasStartedRef.current) {
      hasStartedRef.current = true;
      emitChallengeStarted({ challengeId: today, puzzleId: puzzleData.id });
    }
    const next = recordDailyCompletion(today);
    dispatchDailyProgressChanged();
    setSolveStreak(next.streak);
    emitChallengeCompleted({ challengeId: today, puzzleId: puzzleData.id, movesUsed });
  }

  function handleClose() {
    emitChallengeContinueToLite({ challengeId: today });
    router.push("/hub");
  }

  return (
    <>
      <div className="sheet-bg-hub h-[100dvh]" aria-hidden="true" />
      <DailyTacticSheet
        open
        onOpenChange={(o) => { if (!o) handleClose(); }}
        puzzleData={puzzleData}
        onSolve={handleSolve}
        isConnected={false}
        streakAfterSolve={solveStreak > 0 ? solveStreak : undefined}
        shareUrl={ogCardUrl}
        shareSolvedUrl={ogCardSolvedUrl}
        shareLinkUrl={challengeUrl}
        shareSolvedLinkUrl={challengeUrl}
      />
    </>
  );
}
