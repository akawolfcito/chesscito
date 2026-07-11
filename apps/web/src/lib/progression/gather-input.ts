import type { PieceId, PieceProgress } from "@/lib/game/types";
import type { MilestoneInput } from "./milestones";

export type GatherArgs = {
  piece: PieceId;
  /** Every piece's persisted progress. Missing pieces read as zero. */
  progressByPiece: Partial<Record<PieceId, PieceProgress>>;
  dailyStars: number;
  sessionQuotaExhausted: boolean;
  badgeClaimed: boolean;
  allLabyrinthsComplete: boolean;
  hadGreatSessionBefore: boolean;
};

function sumStars(progress: PieceProgress | undefined): number {
  if (!progress) return 0;
  return Object.values(progress.stars).reduce((sum, value) => sum + value, 0);
}

/** An exercise counts as completed once it has been solved at least once.
 *  A sparse 0 means "played and scored nothing", which is not a completion. */
function countCompleted(progress: PieceProgress | undefined): number {
  if (!progress) return 0;
  return Object.values(progress.stars).filter((value) => value > 0).length;
}

/** Adapter: reads already-persisted progress and shapes it for the pure core.
 *  Introduces NO new source of truth for stars. */
export function gatherMilestoneInput(args: GatherArgs): MilestoneInput {
  const pieces = Object.values(args.progressByPiece) as PieceProgress[];
  const current = args.progressByPiece[args.piece];

  return {
    piece: args.piece,
    lifetimeStars: pieces.reduce((sum, progress) => sum + sumStars(progress), 0),
    completedExercises: pieces.reduce(
      (sum, progress) => sum + countCompleted(progress),
      0,
    ),
    pieceStars: sumStars(current),
    pieceCompletedExercises: countCompleted(current),
    rookStars: sumStars(args.progressByPiece.rook),
    dailyStars: args.dailyStars,
    sessionQuotaExhausted: args.sessionQuotaExhausted,
    badgeClaimed: args.badgeClaimed,
    allLabyrinthsComplete: args.allLabyrinthsComplete,
    hadGreatSessionBefore: args.hadGreatSessionBefore,
  };
}
