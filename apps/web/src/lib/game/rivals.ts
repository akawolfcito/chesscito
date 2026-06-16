import type { ArenaDifficulty } from "@/lib/game/types";

export type RivalPiece = "pawn" | "knight" | "bishop";

export type Rival = {
  difficulty: ArenaDifficulty;
  /** Display name — a humanized rival persona, NOT an "AI" label
   *  (founder 2026-06-15). Proper noun, identical across locales. */
  name: string;
  /** Piece sprite — legacy placeholder, retained for metadata/tests. */
  piece: RivalPiece;
  /** Character avatar slug → `/art/rivals/<avatar>-avatar.{avif,webp,png}`
   *  (custom rival art shipped 2026-06-15). */
  avatar: string;
  /** Difficulty frame color → `/art/rivals/frame-<frame>.{avif,webp,png}`.
   *  blue = easy, silver = medium, gold = hard. */
  frame: "blue" | "silver" | "gold";
  eloMin: number;
  eloMax: number;
};

/** Difficulty → rival persona. The personas humanize the opponent so the
 *  arena reads as "challenge a rival", not "play the AI". Names are
 *  founder-approved placeholders (Sally pass 2026-06-15). */
export const RIVALS: Record<ArenaDifficulty, Rival> = {
  easy: { difficulty: "easy", name: "Pipo", piece: "pawn", avatar: "pipo", frame: "blue", eloMin: 0, eloMax: 800 },
  medium: { difficulty: "medium", name: "Mara", piece: "knight", avatar: "mara", frame: "silver", eloMin: 801, eloMax: 1500 },
  hard: { difficulty: "hard", name: "Kairo", piece: "bishop", avatar: "kairo", frame: "gold", eloMin: 1501, eloMax: 2200 },
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

/** Per-difficulty "thinking" delay window [minMs, maxMs] before the rival
 *  plays. The engine has the move almost instantly; this pause gives the
 *  sensation that the rival is actually thinking. Harder rivals "think"
 *  slightly longer. */
export const AI_THINK_TIME_MS: Record<ArenaDifficulty, [number, number]> = {
  easy: [500, 1300],
  medium: [700, 1700],
  hard: [900, 2100],
};

/** A randomized think delay (ms) for the rival's next move. `rng` is injectable
 *  for tests; defaults to Math.random (allowed in app code). */
export function aiThinkTimeMs(
  difficulty: ArenaDifficulty,
  rng: () => number = Math.random,
): number {
  const [min, max] = AI_THINK_TIME_MS[difficulty];
  return Math.round(min + rng() * (max - min));
}
