import { describe, expect, it } from "vitest";
import enMessages from "@/lib/content/messages/en";
import esMessages from "@/lib/content/messages/es";
import type { PieceId } from "@/lib/game/types";

/**
 * The first-labyrinth unlock is keyed by MILESTONE, so one string greeted all
 * six pieces: "First Maze Unlocked / Guide the rook through it". Right for the
 * rook, a lie for the other five — the bishop got it for its Diagonal Run, the
 * knight for its Tour, the queen for N-Queens (founder, 2026-07-16).
 *
 * These guards keep it honest as more signature games land.
 */
const PIECES: PieceId[] = ["rook", "bishop", "knight", "pawn", "queen", "king"];

/** How each locale NAMES a piece. Checking English words against Spanish copy
 *  is a test that passes without reading anything — the words are never there. */
const PIECE_WORD: Record<string, Record<PieceId, string>> = {
  EN: { rook: "rook", bishop: "bishop", knight: "knight", pawn: "pawn", queen: "queen", king: "king" },
  ES: { rook: "torre", bishop: "alfil", knight: "caballo", pawn: "peón", queen: "dama", king: "rey" },
};

/** Game names a generic, milestone-keyed line cannot know either. */
const GAME_WORD: Record<string, string[]> = {
  EN: ["maze", "tour", "pivot", "queens"],
  ES: ["laberinto", "gira", "pivote", "damas"],
};

type UnlockCopy = {
  title: string;
  body: string;
  primary: string;
  byPiece: Record<string, { title: string; body: string; primary: string }>;
};

const unlock = (m: unknown): UnlockCopy =>
  (m as { PROGRESSION_COPY: Record<string, UnlockCopy> }).PROGRESSION_COPY[
    "first-labyrinth"
  ];

describe.each([
  ["EN", enMessages],
  ["ES", esMessages],
])("first-labyrinth unlock copy (%s)", (locale, messages) => {
  const copy = unlock(messages);
  const word = PIECE_WORD[locale];

  it("names the game for every piece", () => {
    for (const piece of PIECES) {
      expect(copy.byPiece[piece]?.title, `${piece} title`).toBeTruthy();
      expect(copy.byPiece[piece]?.body, `${piece} body`).toBeTruthy();
      expect(copy.byPiece[piece]?.primary, `${piece} primary`).toBeTruthy();
    }
  });

  it("never tells a piece it is another piece", () => {
    // The exact failure that shipped: bishop, knight and queen were all told to
    // guide the ROOK. A piece's copy may only ever name itself.
    for (const piece of PIECES) {
      const body = copy.byPiece[piece].body.toLowerCase();
      for (const other of PIECES) {
        if (other === piece) continue;
        expect(body, `${piece} body names the ${other}`).not.toContain(word[other]);
      }
    }
  });

  it("keeps the generic fallback free of any piece or game name", () => {
    // It cannot know which one unlocked, so it must never guess. This is the
    // rule that makes the original bug unrepeatable rather than merely fixed.
    const generic = `${copy.title} ${copy.body} ${copy.primary}`.toLowerCase();
    for (const piece of PIECES) {
      expect(generic, `generic copy names the ${piece}`).not.toContain(word[piece]);
    }
    for (const game of GAME_WORD[locale]) {
      expect(generic, `generic copy names "${game}"`).not.toContain(game);
    }
  });
});
