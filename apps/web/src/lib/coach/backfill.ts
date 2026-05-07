import type {
  CoachAnalysisRecord,
  CoachAnalysisRow,
  GameRecord,
} from "./types.js";
import { extractWeaknessTagsSafe } from "./persistence.js";

const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;

/**
 * Build a `CoachAnalysisRow` from a Redis (analysis, game) pair.
 *
 * Returns `null` when:
 * - either input is missing (caller should skip the gameId), or
 * - the response is `kind: "quick"` (BasicCoachResponse rows are not yet
 *   stored in v1; the schema's `kind in ('full','quick')` constraint
 *   tolerates them but the writer only emits `kind='full'`).
 *
 * Sets `expires_at = analysis.createdAt + 1 year` so the privacy notice
 * "365 days from creation" stays accurate even though the orchestrator
 * is back-dating relative to `now()` (red-team P1-6).
 *
 * Tag derivation is fail-soft — the orchestrator (Task 4) decides whether
 * to log `coach_tag_extraction_failed` based on the discarded `tagError`.
 * The row inserts even on extraction failure (red-team P1-7).
 */
export function buildBackfillRow(
  wallet: string,
  gameId: string,
  analysis: CoachAnalysisRecord | null,
  game: GameRecord | null,
): CoachAnalysisRow | null {
  if (!analysis || !game) return null;
  if (analysis.response.kind !== "full") return null;

  const { tags } = extractWeaknessTagsSafe(
    analysis.response.mistakes,
    game.totalMoves,
    game.result,
  );

  return {
    wallet,
    game_id: gameId,
    created_at: new Date(analysis.createdAt).toISOString(),
    expires_at: new Date(analysis.createdAt + ONE_YEAR_MS).toISOString(),
    kind: "full",
    difficulty: game.difficulty,
    result: game.result,
    total_moves: game.totalMoves,
    summary_text: analysis.response.summary,
    mistakes: analysis.response.mistakes,
    lessons: analysis.response.lessons,
    praise: analysis.response.praise,
    weakness_tags: tags,
  };
}
