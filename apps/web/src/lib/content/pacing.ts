/**
 * The one tunable knob of the difficulty-curve linter, in its own module so the
 * builder UI can name it without importing `lint.ts`.
 *
 * `lint.ts` pulls in the BFS solver and the FEN mapper. The builder page is a
 * client component, so importing the linter just to print a number would drag
 * that whole graph toward the browser bundle. A constant has no dependencies.
 *
 * The point of the split is that the UI quotes the LIVE value: the warning text
 * and the footer that tells the author where to change it can never drift apart
 * from the rule that produced them.
 */

/**
 * The largest jump in `optimalMoves` a single curriculum step may make without
 * comment. Two is a lesson; three is where a beginner stops seeing the
 * connection to the board they just solved.
 *
 * A judgement, not a law — raise it if the linter nags, lower it if spikes slip
 * through. Nothing it produces can ever fail a build.
 */
export const MAX_DIFFICULTY_STEP = 2;
