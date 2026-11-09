/**
 * OG exercise card copy (Slice A — SaveScore share fix).
 *
 * Pure label map for the non-daily `/api/og/exercise` share card. Extracted
 * so the SCORE-SAVED share renders a leaderboard-first card instead of
 * borrowing the PIECE-MASTERED template (the live "ROOK MASTERED" bug after
 * an off-chain score save).
 *
 * piece-complete / badge-earned values are byte-identical to the previous
 * inline strings (regression-safe). score-saved is the new lane: it never
 * says "Mastered" and its footer never claims "saved on Celo" (the base
 * save is off-chain now).
 */

export type OgExerciseAchievementType =
  | "piece-complete"
  | "badge-earned"
  | "score-saved";

export type OgExerciseCardCopy = {
  /** Small uppercase label above the title. */
  eyebrow: string;
  /** Hero title. */
  title: string;
  /** Subtitle beneath the piece + score badge. */
  tagline: string;
  /** Card footer line. */
  footer: string;
};

const FOOTER_SAVED_ON_CELO = "Chesscito • saved on Celo";
const FOOTER_LEADERBOARD = "Chesscito • Leaderboard";

export function ogExerciseCardCopy(
  type: OgExerciseAchievementType,
  pieceLabel: string,
  stars: number,
): OgExerciseCardCopy {
  switch (type) {
    case "badge-earned":
      return {
        eyebrow: "BADGE UNLOCKED",
        title: `${pieceLabel} Ascendant`,
        tagline: `${pieceLabel} Ascendant is now yours to keep`,
        footer: FOOTER_SAVED_ON_CELO,
      };
    case "score-saved":
      return {
        eyebrow: "SCORE SAVED",
        title: "On the leaderboard",
        tagline: `${stars}/15 stars. Can you beat it?`,
        footer: FOOTER_LEADERBOARD,
      };
    case "piece-complete":
    default:
      return {
        eyebrow: "PIECE COMPLETE",
        title: `${pieceLabel} Mastered`,
        tagline: `${pieceLabel} Ascendant is now yours to keep`,
        footer: FOOTER_SAVED_ON_CELO,
      };
  }
}
