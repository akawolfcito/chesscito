import { describe, it, expect } from "vitest";
import { buildBackfillRow } from "../backfill.js";
import type {
  CoachAnalysisRecord,
  GameRecord,
  CoachResponse,
  BasicCoachResponse,
} from "../types.js";

const VALID_WALLET = "0x1234567890abcdef1234567890abcdef12345678";
const VALID_GAME_ID = "11111111-2222-3333-4444-555555555555";

const FULL_RESPONSE: CoachResponse = {
  kind: "full",
  summary: "You lost a tight middlegame.",
  mistakes: [
    { moveNumber: 12, played: "Nf3", better: "Nd2", explanation: "Black hung the bishop on g7." },
  ],
  lessons: ["Watch for hanging pieces."],
  praise: ["Solid opening."],
};

function analysis(overrides: Partial<CoachAnalysisRecord> = {}): CoachAnalysisRecord {
  return {
    gameId: VALID_GAME_ID,
    provider: "server",
    analysisVersion: "1.0.0",
    createdAt: 1714780800000, // 2024-05-04T00:00:00.000Z (deterministic)
    response: FULL_RESPONSE,
    ...overrides,
  };
}

function game(overrides: Partial<GameRecord> = {}): GameRecord {
  return {
    gameId: VALID_GAME_ID,
    moves: ["e4", "e5", "Nf3"],
    result: "lose",
    difficulty: "medium",
    totalMoves: 30,
    elapsedMs: 100_000,
    timestamp: 1714780800000,
    ...overrides,
  };
}

describe("buildBackfillRow", () => {
  it("returns null when analysis is missing", () => {
    expect(buildBackfillRow(VALID_WALLET, VALID_GAME_ID, null, game())).toBeNull();
  });

  it("returns null when game is missing", () => {
    expect(buildBackfillRow(VALID_WALLET, VALID_GAME_ID, analysis(), null)).toBeNull();
  });

  it("returns null when analysis.response.kind is not 'full' (BasicCoachResponse not stored in v1)", () => {
    const quickResponse: BasicCoachResponse = { kind: "quick", summary: "Try X.", tips: ["foo"] };
    expect(
      buildBackfillRow(VALID_WALLET, VALID_GAME_ID, analysis({ response: quickResponse }), game()),
    ).toBeNull();
  });

  it("returns a fully-shaped CoachAnalysisRow on the happy path", () => {
    const row = buildBackfillRow(VALID_WALLET, VALID_GAME_ID, analysis(), game());
    expect(row).not.toBeNull();
    expect(row).toMatchObject({
      wallet: VALID_WALLET,
      game_id: VALID_GAME_ID,
      kind: "full",
      difficulty: "medium",
      result: "lose",
      total_moves: 30,
      summary_text: "You lost a tight middlegame.",
    });
    expect(row!.weakness_tags).toEqual(["hanging-piece"]); // matches "hung the bishop"
  });

  it("sets expires_at to createdAt + 365 days (red-team P1-6)", () => {
    const row = buildBackfillRow(VALID_WALLET, VALID_GAME_ID, analysis(), game());
    expect(row!.created_at).toBe(new Date(1714780800000).toISOString());
    const expectedExpiry = new Date(1714780800000 + 365 * 24 * 60 * 60 * 1000).toISOString();
    expect(row!.expires_at).toBe(expectedExpiry);
  });

  it("returns row with weakness_tags=[] when no rule matches (P1-7 fail-soft path is exercised by extractWeaknessTagsSafe's own tests)", () => {
    const row = buildBackfillRow(
      VALID_WALLET,
      VALID_GAME_ID,
      analysis({
        response: {
          kind: "full",
          summary: "Routine game.",
          mistakes: [{ moveNumber: 18, played: "Nf3", better: "Nd2", explanation: "Routine inaccuracy." }],
          lessons: [],
          praise: [],
        },
      }),
      game({ totalMoves: 20, result: "win" }),
    );
    expect(row!.weakness_tags).toEqual([]);
  });
});
