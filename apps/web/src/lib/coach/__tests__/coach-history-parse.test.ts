import { describe, it, expect } from "vitest";
import {
  parseAnalyzedHistory,
  parseUnanalyzedGames,
} from "../coach-history-parse.js";

const UUID_A = "11111111-2222-3333-4444-555555555555";
const UUID_B = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
const UUID_C = "99999999-8888-7777-6666-555555555555";

describe("parseAnalyzedHistory", () => {
  it("returns [] when input is not an array (rate-limit / 403 / null)", () => {
    expect(parseAnalyzedHistory(null)).toEqual([]);
    expect(parseAnalyzedHistory(undefined)).toEqual([]);
    expect(parseAnalyzedHistory({ error: "Too many requests" })).toEqual([]);
    expect(parseAnalyzedHistory("string")).toEqual([]);
  });

  it("keeps well-formed entries and tags them kind:'analyzed'", () => {
    const input = [
      { gameId: UUID_A, game: { gameId: UUID_A, moves: [] }, analysis: { text: "..." } },
    ];
    const out = parseAnalyzedHistory(input);
    expect(out).toHaveLength(1);
    expect(out[0].kind).toBe("analyzed");
    expect(out[0].gameId).toBe(UUID_A);
  });

  it("drops entries missing gameId or game (legacy schema guard)", () => {
    const input = [
      { gameId: UUID_A, game: { gameId: UUID_A } },
      { gameId: UUID_B }, // missing game
      { game: { gameId: UUID_A } }, // missing gameId
      null,
      "string",
      42,
    ];
    const out = parseAnalyzedHistory(input);
    expect(out).toHaveLength(1);
    expect(out[0].gameId).toBe(UUID_A);
  });

  it("drops entries with non-UUID gameId (defer #4 — defense-in-depth)", () => {
    const input = [
      { gameId: UUID_A, game: { gameId: UUID_A } },
      { gameId: "legacy-id", game: { gameId: "legacy-id" } },
      { gameId: "", game: { gameId: "" } },
      { gameId: "<script>", game: { gameId: "<script>" } },
      { gameId: 12345, game: { gameId: 12345 } }, // wrong type
    ];
    const out = parseAnalyzedHistory(input);
    expect(out).toHaveLength(1);
    expect(out[0].gameId).toBe(UUID_A);
  });

  it("dedups same gameId across locales — first occurrence wins (2026-05-24)", () => {
    // Per-locale cache key migration: a game analyzed in both EN and ES
    // could surface twice in the server payload if the LPUSH'd analysisList
    // isn't deduped upstream. Parser is the defense-in-depth backstop.
    const input = [
      { gameId: UUID_A, locale: "es", game: { gameId: UUID_A } },
      { gameId: UUID_A, locale: "en", game: { gameId: UUID_A } },
      { gameId: UUID_B, locale: "en", game: { gameId: UUID_B } },
    ];
    const out = parseAnalyzedHistory(input);
    expect(out).toHaveLength(2);
    expect(out.map((e) => e.gameId)).toEqual([UUID_A, UUID_B]);
    // First-wins: the ES record came first in the input array, so it survives.
    expect((out[0] as unknown as { locale: string }).locale).toBe("es");
  });
});

describe("parseUnanalyzedGames", () => {
  it("returns [] when input is not an array", () => {
    expect(parseUnanalyzedGames(null, new Set())).toEqual([]);
    expect(parseUnanalyzedGames({ error: "Forbidden" }, new Set())).toEqual([]);
  });

  it("keeps well-formed entries with valid UUID and tags them kind:'unanalyzed'", () => {
    const input = [
      { gameId: UUID_A, moves: [], result: "win" },
      { gameId: UUID_B, moves: [], result: "loss" },
    ];
    const out = parseUnanalyzedGames(input, new Set());
    expect(out).toHaveLength(2);
    expect(out.every((g) => g.kind === "unanalyzed")).toBe(true);
    expect(out.map((g) => g.gameId)).toEqual([UUID_A, UUID_B]);
  });

  it("excludes gameIds already present in the analyzed set (dedupe)", () => {
    const input = [
      { gameId: UUID_A, moves: [] },
      { gameId: UUID_B, moves: [] },
      { gameId: UUID_C, moves: [] },
    ];
    const analyzed = new Set([UUID_A, UUID_C]);
    const out = parseUnanalyzedGames(input, analyzed);
    expect(out.map((g) => g.gameId)).toEqual([UUID_B]);
  });

  it("drops entries with non-UUID gameId (defer #4 — defense-in-depth)", () => {
    const input = [
      { gameId: UUID_A, moves: [] },
      { gameId: "not-a-uuid", moves: [] },
      { gameId: "", moves: [] },
      { gameId: null, moves: [] },
    ];
    const out = parseUnanalyzedGames(input, new Set());
    expect(out).toHaveLength(1);
    expect(out[0].gameId).toBe(UUID_A);
  });

  it("drops entries missing gameId field entirely", () => {
    const input = [
      { gameId: UUID_A },
      { moves: [] }, // no gameId
      {},
      null,
    ];
    const out = parseUnanalyzedGames(input, new Set());
    expect(out).toHaveLength(1);
  });
});
