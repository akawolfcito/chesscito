import { Chess } from "chess.js";
import type { ArenaDifficulty } from "./types";

export const ARENA_GAME_KEY = "chesscito:arena-game";

/** Saves older than this are dropped on restore (user likely forgot). */
const ARENA_GAME_TTL_MS = 24 * 60 * 60 * 1000;

export type ArenaGameSave = {
  fen: string;
  moveHistory: string[];
  moveCount: number;
  elapsedMs: number;
  difficulty: ArenaDifficulty;
  savedAt: number;
};

function isArenaDifficulty(value: unknown): value is ArenaDifficulty {
  return value === "easy" || value === "medium" || value === "hard";
}

/** Parse + validate a localStorage payload. Returns null if corrupt,
 *  stale (>24h), or references an invalid FEN. */
export function loadArenaGame(): ArenaGameSave | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(ARENA_GAME_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<ArenaGameSave>;
    if (
      typeof parsed.fen !== "string" ||
      !Array.isArray(parsed.moveHistory) ||
      typeof parsed.moveCount !== "number" ||
      typeof parsed.elapsedMs !== "number" ||
      typeof parsed.savedAt !== "number" ||
      !isArenaDifficulty(parsed.difficulty)
    ) {
      clearArenaGame();
      return null;
    }

    if (Date.now() - parsed.savedAt > ARENA_GAME_TTL_MS) {
      clearArenaGame();
      return null;
    }

    // Chess throws on invalid FEN; we'd rather discard than rehydrate garbage.
    try {
      new Chess(parsed.fen);
    } catch {
      clearArenaGame();
      return null;
    }

    return {
      fen: parsed.fen,
      moveHistory: parsed.moveHistory.filter((m): m is string => typeof m === "string"),
      moveCount: parsed.moveCount,
      elapsedMs: parsed.elapsedMs,
      difficulty: parsed.difficulty,
      savedAt: parsed.savedAt,
    };
  } catch {
    clearArenaGame();
    return null;
  }
}

export function saveArenaGame(save: Omit<ArenaGameSave, "savedAt">): void {
  if (typeof window === "undefined") return;
  try {
    const payload: ArenaGameSave = { ...save, savedAt: Date.now() };
    window.localStorage.setItem(ARENA_GAME_KEY, JSON.stringify(payload));
  } catch {
    // storage full / unavailable — nothing useful we can do here
  }
}

export function clearArenaGame(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(ARENA_GAME_KEY);
  } catch {
    // ignore
  }
}
