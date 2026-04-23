import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  ARENA_GAME_KEY,
  clearArenaGame,
  loadArenaGame,
  saveArenaGame,
} from "../arena-persistence";

const VALID_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 0";
const AFTER_E4_FEN = "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1";

function makeSave(overrides: Partial<ReturnType<typeof loadArenaGame>> = {}) {
  return {
    fen: AFTER_E4_FEN,
    moveHistory: ["e4"],
    moveCount: 1,
    elapsedMs: 5000,
    difficulty: "easy" as const,
    savedAt: Date.now(),
    ...overrides,
  };
}

describe("arena-persistence", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
    vi.useRealTimers();
  });

  describe("saveArenaGame", () => {
    it("writes a valid payload with savedAt timestamp", () => {
      saveArenaGame({
        fen: AFTER_E4_FEN,
        moveHistory: ["e4"],
        moveCount: 1,
        elapsedMs: 1000,
        difficulty: "medium",
      });

      const raw = localStorage.getItem(ARENA_GAME_KEY);
      expect(raw).toBeTruthy();
      const parsed = JSON.parse(raw!);
      expect(parsed.fen).toEqual(AFTER_E4_FEN);
      expect(parsed.difficulty).toEqual("medium");
      expect(typeof parsed.savedAt).toEqual("number");
    });
  });

  describe("loadArenaGame", () => {
    it("returns null when no save exists", () => {
      expect(loadArenaGame()).toBeNull();
    });

    it("round-trips a valid save", () => {
      saveArenaGame({
        fen: AFTER_E4_FEN,
        moveHistory: ["e4"],
        moveCount: 1,
        elapsedMs: 5000,
        difficulty: "hard",
      });

      const loaded = loadArenaGame();
      expect(loaded).not.toBeNull();
      expect(loaded!.fen).toEqual(AFTER_E4_FEN);
      expect(loaded!.moveCount).toEqual(1);
      expect(loaded!.difficulty).toEqual("hard");
    });

    it("discards corrupt JSON and clears the key", () => {
      localStorage.setItem(ARENA_GAME_KEY, "{not json");
      expect(loadArenaGame()).toBeNull();
      expect(localStorage.getItem(ARENA_GAME_KEY)).toBeNull();
    });

    it("discards a save with a missing field", () => {
      localStorage.setItem(
        ARENA_GAME_KEY,
        JSON.stringify({ fen: VALID_FEN, moveHistory: [], elapsedMs: 0, difficulty: "easy", savedAt: Date.now() }),
      );
      expect(loadArenaGame()).toBeNull();
      expect(localStorage.getItem(ARENA_GAME_KEY)).toBeNull();
    });

    it("discards an unknown difficulty value", () => {
      localStorage.setItem(
        ARENA_GAME_KEY,
        JSON.stringify(makeSave({ difficulty: "impossible" as unknown as "easy" })),
      );
      expect(loadArenaGame()).toBeNull();
    });

    it("discards saves older than 24h", () => {
      const stale = Date.now() - 25 * 60 * 60 * 1000;
      localStorage.setItem(ARENA_GAME_KEY, JSON.stringify(makeSave({ savedAt: stale })));
      expect(loadArenaGame()).toBeNull();
      expect(localStorage.getItem(ARENA_GAME_KEY)).toBeNull();
    });

    it("discards saves with invalid FEN strings", () => {
      localStorage.setItem(
        ARENA_GAME_KEY,
        JSON.stringify(makeSave({ fen: "not a fen" })),
      );
      expect(loadArenaGame()).toBeNull();
    });

    it("filters non-string entries from moveHistory", () => {
      localStorage.setItem(
        ARENA_GAME_KEY,
        JSON.stringify(
          makeSave({
            moveHistory: ["e4", 42 as unknown as string, null as unknown as string, "e5"],
          }),
        ),
      );
      const loaded = loadArenaGame();
      expect(loaded!.moveHistory).toEqual(["e4", "e5"]);
    });
  });

  describe("clearArenaGame", () => {
    it("removes the key without throwing when absent", () => {
      expect(() => clearArenaGame()).not.toThrow();
    });

    it("removes an existing save", () => {
      saveArenaGame({
        fen: AFTER_E4_FEN,
        moveHistory: [],
        moveCount: 0,
        elapsedMs: 0,
        difficulty: "easy",
      });
      clearArenaGame();
      expect(localStorage.getItem(ARENA_GAME_KEY)).toBeNull();
    });
  });
});
