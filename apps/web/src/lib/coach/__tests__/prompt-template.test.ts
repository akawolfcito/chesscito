import { describe, it, expect } from "vitest";
import { buildCoachPrompt } from "../prompt-template.js";

const FREE_PATH_FIXTURE = {
  moves: ["e4", "e5", "Nf3", "Nc6", "Bb5", "a6", "Ba4", "Nf6"],
  result: "lose" as const,
  difficulty: "medium",
};

describe("buildCoachPrompt — free path (regression guard)", () => {
  it("produces the locked free-path output when summary is null", () => {
    const out = buildCoachPrompt(
      FREE_PATH_FIXTURE.moves,
      FREE_PATH_FIXTURE.result,
      FREE_PATH_FIXTURE.difficulty,
      null,
    );
    // Inline snapshot — vitest auto-populates on first run.
    // Any drift in subsequent commits fails this test by definition.
    expect(out).toMatchInlineSnapshot(`
      "You are a chess coach analyzing a game played on Chesscito (a learning app for beginners and casual players).

      Game: 1. e4 1... e5 2. Nf3 2... Nc6 3. Bb5 3... a6 4. Ba4 4... Nf6
      Result: lose (medium difficulty AI opponent)


      The player lost. Be encouraging. Focus on: (1) what went wrong (kindly), (2) critical mistakes that turned the game, (3) concrete skills to practice.

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
      - Keep explanations simple — the player may be a beginner"
    `);
  });

  it("includes the summary block verbatim when summary is supplied", () => {
    const out = buildCoachPrompt(
      FREE_PATH_FIXTURE.moves,
      FREE_PATH_FIXTURE.result,
      FREE_PATH_FIXTURE.difficulty,
      {
        gamesPlayed: 12,
        recentMistakeCategories: [],
        avgGameLength: 28.4,
        difficultyDistribution: {},
        weaknessTags: ["king-safety", "tactics"],
      },
    );
    expect(out).toContain("Player context: 12 games played");
    expect(out).toContain("avg 28 moves per game");
    expect(out).toContain("Recent weaknesses: king-safety, tactics");
  });

  it("uses the lose RESULT_HINT for result=lose", () => {
    const out = buildCoachPrompt(["e4"], "lose", "medium", null);
    expect(out).toContain("The player lost. Be encouraging.");
  });
});
