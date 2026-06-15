import type { ArenaDifficulty } from "@/lib/game/types";

export type RivalPiece = "pawn" | "knight" | "bishop";

export type Rival = {
  difficulty: ArenaDifficulty;
  /** Display name — a humanized rival persona, NOT an "AI" label
   *  (founder 2026-06-15). Proper noun, identical across locales. */
  name: string;
  /** Piece sprite used as the placeholder avatar until a custom
   *  character avatar ships. */
  piece: RivalPiece;
  eloMin: number;
  eloMax: number;
};

/** Difficulty → rival persona. The personas humanize the opponent so the
 *  arena reads as "challenge a rival", not "play the AI". Names are
 *  founder-approved placeholders (Sally pass 2026-06-15). */
export const RIVALS: Record<ArenaDifficulty, Rival> = {
  easy: { difficulty: "easy", name: "Pipo", piece: "pawn", eloMin: 0, eloMax: 800 },
  medium: { difficulty: "medium", name: "Mara", piece: "knight", eloMin: 801, eloMax: 1500 },
  hard: { difficulty: "hard", name: "Kairo", piece: "bishop", eloMin: 1501, eloMax: 2200 },
};

export function rivalFor(difficulty: ArenaDifficulty): Rival {
  return RIVALS[difficulty];
}

/** "0 - 800 ELO" range label for the selector card. */
export function eloRangeLabel(difficulty: ArenaDifficulty): string {
  const r = RIVALS[difficulty];
  return `${r.eloMin} - ${r.eloMax} ELO`;
}

/** Pick a representative ELO within the rival's range. Generated once at
 *  game start (caller stores it) so it stays stable for the whole match
 *  and is shown in the gameplay HUD chip. Uses Math.random — allowed in
 *  app code (only forbidden in workflow scripts). */
export function randomEloForDifficulty(difficulty: ArenaDifficulty): number {
  const { eloMin, eloMax } = RIVALS[difficulty];
  return eloMin + Math.floor(Math.random() * (eloMax - eloMin + 1));
}
