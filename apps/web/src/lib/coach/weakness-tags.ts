import type { CoachGameResult, Mistake, WeaknessTag } from "./types";

const KEYWORD_RULES: ReadonlyArray<{ tag: WeaknessTag; pattern: RegExp }> = [
  {
    tag: "hanging-piece",
    pattern: /\b(hung|undefended|free capture|left[^.]*unprotected)\b/i,
  },
  {
    tag: "missed-tactic",
    pattern: /\b(missed|overlooked)[^.]*?\b(fork|pin|skewer|tactic|combination)\b/i,
  },
  {
    tag: "weak-king-safety",
    pattern: /\b(king (exposed|unsafe|weak)|open file near king|attack on the king)\b/i,
  },
  {
    tag: "weak-pawn-structure",
    pattern: /\b(doubled pawns?|isolated pawn|pawn weakness|backward pawn)\b/i,
  },
] as const;

const TAXONOMY_ORDER: readonly WeaknessTag[] = [
  "hanging-piece",
  "missed-tactic",
  "weak-king-safety",
  "weak-pawn-structure",
  "opening-blunder",
  "endgame-conversion",
] as const;

/**
 * Deterministic 6-label v1 taxonomy. Returns the set of tags that match
 * across the supplied `mistakes`. Order: keyword tags in declaration order
 * first, then positional tags. Duplicates are removed.
 *
 * - Keyword rules scan each `mistake.explanation` independently.
 * - Positional rules consider the mistake list as a whole + game stats.
 *
 * No fuzzy matching, no ML — adding labels is a v2 contract change.
 * See spec §5 + §15 (P1-1).
 */
export function extractWeaknessTags(
  mistakes: Mistake[],
  _totalMoves: number,
  result: CoachGameResult,
): WeaknessTag[] {
  const found = new Set<WeaknessTag>();

  for (const m of mistakes) {
    for (const rule of KEYWORD_RULES) {
      if (rule.pattern.test(m.explanation)) {
        found.add(rule.tag);
      }
    }
  }

  // Positional rule 1: opening-blunder
  // Fires when there are 2+ mistakes and at least one is at moveNumber ≤ 12.
  if (mistakes.length >= 2 && mistakes.some((m) => m.moveNumber <= 12)) {
    found.add("opening-blunder");
  }

  // Positional rule 2: endgame-conversion
  // Fires when there's a mistake at moveNumber ≥ 30 and result ∈ {lose,draw}.
  if (
    (result === "lose" || result === "draw") &&
    mistakes.some((m) => m.moveNumber >= 30)
  ) {
    found.add("endgame-conversion");
  }

  // Preserve declaration order (Set iteration order = insertion order, but
  // we want canonical taxonomy order regardless of which rule fired first).
  return TAXONOMY_ORDER.filter((t) => found.has(t));
}
