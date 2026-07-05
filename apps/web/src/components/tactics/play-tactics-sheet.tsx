"use client";

import { useMemo } from "react";
import { DailyTacticSheet } from "@/components/daily/daily-tactic-sheet";
import { getDailyTactic } from "@/lib/daily/daily-puzzles";
import {
  playTacticsTodayUtc,
  recordPlayTacticsCompletion,
  type PlayTacticsProgress,
} from "@/lib/tactics/progress";
import {
  emitPlayTacticsCompleted,
  emitPlayTacticsFailed,
} from "@/lib/tactics/telemetry";

type PlayTacticsSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCompleted: (progress: PlayTacticsProgress) => void;
};

/** Play-owned wrapper around the shared board/sheet primitive. No Daily Focus
 * progress, Peones, Welcome Gift, quota or challenge code is imported here. */
export function PlayTacticsSheet({
  open,
  onOpenChange,
  onCompleted,
}: PlayTacticsSheetProps) {
  const today = playTacticsTodayUtc();
  const puzzle = useMemo(() => getDailyTactic(today), [today]);

  return (
    <DailyTacticSheet
      open={open}
      onOpenChange={onOpenChange}
      puzzleData={puzzle}
      experience="play"
      onSolve={(movesUsed) => {
        const progress = recordPlayTacticsCompletion(today);
        emitPlayTacticsCompleted({
          puzzleId: puzzle.id,
          piece: puzzle.piece,
          movesUsed,
          totalCompleted: progress.totalCompleted,
        });
        onCompleted(progress);
      }}
      onFail={(movesUsed) => {
        emitPlayTacticsFailed({
          puzzleId: puzzle.id,
          piece: puzzle.piece,
          movesUsed,
        });
      }}
    />
  );
}
