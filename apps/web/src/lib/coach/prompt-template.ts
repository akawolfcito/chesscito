import type { GameResult, HistoryDigest, PlayerSummary } from "./types";

/**
 * Truncate `text` to at most `max` Unicode code points. If exceeded, the
 * last char is replaced with U+2026 (HORIZONTAL ELLIPSIS) so the result
 * length is exactly `max`.
 *
 * Defense-in-depth for the augmentation block (red-team P1-3). v1
 * taxonomy makes >600 unreachable; v2 work must re-evaluate.
 */
export function truncateAtLimit(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max - 1) + "…";
}

const RESULT_HINTS: Record<GameResult, string> = {
  win: "The player won. Focus on: (1) strengths shown, (2) moments where a stronger opponent would have punished them, (3) how to win more efficiently.",
  lose: "The player lost. Be encouraging. Focus on: (1) what went wrong (kindly), (2) critical mistakes that turned the game, (3) concrete skills to practice.",
  draw: "The game was a draw. Focus on: (1) why the game didn't resolve, (2) missed opportunities to press advantage, (3) how to convert drawn positions.",
  resigned: "The player resigned. Focus on: (1) the turning point, (2) the position that felt lost + a safer continuation, (3) pattern recognition for similar positions.",
};

const HISTORY_BLOCK_CHAR_CAP = 600;

function buildHistoryAugmentation(history: HistoryDigest | null | undefined): string {
  if (!history) return "";

  const { gamesPlayed, recentResults, topWeaknessTags } = history;
  const header =
    `Player history (last 20 games): ${gamesPlayed} games.\n` +
    `Recent results: W:${recentResults.win} L:${recentResults.lose} D:${recentResults.draw}.`;

  if (topWeaknessTags.length === 0) {
    const guard =
      "Insufficient pattern data this session — do NOT speculate about\n" +
      "recurring weaknesses or strengths across past games. Analyze\n" +
      "ONLY the current game.";
    return truncateAtLimit(`\n${header}\n\n${guard}`, HISTORY_BLOCK_CHAR_CAP);
  }

  const tagsLine =
    "Recurring weakness areas: " +
    topWeaknessTags.map((t) => `${t.tag} (×${t.count})`).join(", ") +
    ".";

  const callout =
    "When analyzing this game, if any of the above weakness areas appear,\n" +
    'call them out by name — e.g., "you\'ve shown weak king safety in 4 of\n' +
    'your last 8 games." Tie the call-out to the count above. ' +
    "Do not fabricate a pattern that isn't in the data.";

  return truncateAtLimit(`\n${header}\n${tagsLine}\n\n${callout}`, HISTORY_BLOCK_CHAR_CAP);
}

export function buildCoachPrompt(
  moves: string[],
  result: GameResult,
  difficulty: string,
  summary: PlayerSummary | null,
  history?: HistoryDigest | null,
): string {
  const movesStr = moves.map((m, i) => `${Math.floor(i / 2) + 1}${i % 2 === 0 ? "." : "..."} ${m}`).join(" ");

  const summaryBlock = summary
    ? `\nPlayer context: ${summary.gamesPlayed} games played, avg ${Math.round(summary.avgGameLength)} moves per game. Recent weaknesses: ${summary.weaknessTags.slice(0, 5).join(", ") || "none identified yet"}.`
    : "";

  const historyBlock = buildHistoryAugmentation(history);

  return `You are a chess coach analyzing a game played on Chesscito (a learning app for beginners and casual players).

Game: ${movesStr}
Result: ${result} (${difficulty} difficulty AI opponent)
${summaryBlock}${historyBlock}

${RESULT_HINTS[result]}

Respond ONLY with a JSON object matching this exact schema (no markdown, no explanation outside JSON):
{
  "kind": "full",
  "summary": "2-3 sentence conversational summary of the game",
  "mistakes": [{"moveNumber": N, "played": "move", "better": "alternative", "explanation": "why"}],
  "lessons": ["actionable lesson 1", ...],
  "praise": ["specific thing done well", ...]
}

Rules:
- mistakes: max 5, only include genuine mistakes
- lessons: max 3, concrete and actionable
- praise: max 2, specific to this game (never empty — find something positive even in a loss)
- All text in English
- Keep explanations simple — the player may be a beginner`;
}
