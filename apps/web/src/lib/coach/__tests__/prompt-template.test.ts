import { describe, it, expect } from "vitest";
import { buildCoachPrompt, truncateAtLimit } from "../prompt-template.js";

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

describe("buildCoachPrompt — PRO standard branch (populated tags)", () => {
  it("includes 'Player history (last 20 games):' header with gamesPlayed", () => {
    const out = buildCoachPrompt(
      FREE_PATH_FIXTURE.moves,
      "lose",
      "medium",
      null,
      {
        gamesPlayed: 14,
        recentResults: { win: 5, lose: 7, draw: 1, resigned: 1 },
        topWeaknessTags: [
          { tag: "weak-king-safety", count: 4 },
          { tag: "missed-tactic", count: 3 },
        ],
      },
    );
    expect(out).toContain("Player history (last 20 games): 14 games.");
  });

  it("renders Recent results line as W:L:D (no resigned in display)", () => {
    const out = buildCoachPrompt(["e4"], "lose", "medium", null, {
      gamesPlayed: 14,
      recentResults: { win: 5, lose: 7, draw: 1, resigned: 1 },
      topWeaknessTags: [{ tag: "weak-king-safety", count: 4 }],
    });
    expect(out).toContain("Recent results: W:5 L:7 D:1.");
    expect(out).not.toContain("R:1");
  });

  it("renders 'Recurring weakness areas:' with tag (×count) joined by ', '", () => {
    const out = buildCoachPrompt(["e4"], "lose", "medium", null, {
      gamesPlayed: 14,
      recentResults: { win: 5, lose: 7, draw: 1, resigned: 1 },
      topWeaknessTags: [
        { tag: "weak-king-safety", count: 4 },
        { tag: "missed-tactic", count: 3 },
      ],
    });
    expect(out).toContain("Recurring weakness areas: weak-king-safety (×4), missed-tactic (×3).");
  });

  it("includes the call-out instruction with 'Do not fabricate a pattern that isn't in the data.'", () => {
    const out = buildCoachPrompt(["e4"], "lose", "medium", null, {
      gamesPlayed: 14,
      recentResults: { win: 5, lose: 7, draw: 1, resigned: 1 },
      topWeaknessTags: [{ tag: "weak-king-safety", count: 4 }],
    });
    expect(out).toContain("call them out by name");
    expect(out).toContain("Do not fabricate a pattern that isn't in the data.");
  });

  it("does NOT contain the no-evidence hard-guard text when tags are populated", () => {
    const out = buildCoachPrompt(["e4"], "lose", "medium", null, {
      gamesPlayed: 14,
      recentResults: { win: 5, lose: 7, draw: 1, resigned: 1 },
      topWeaknessTags: [{ tag: "weak-king-safety", count: 4 }],
    });
    expect(out).not.toContain("do NOT speculate");
  });
});

describe("buildCoachPrompt — PRO no-evidence branch (empty topWeaknessTags)", () => {
  it("renders the hard-guard variant with 'do NOT speculate'", () => {
    const out = buildCoachPrompt(["e4"], "lose", "medium", null, {
      gamesPlayed: 6,
      recentResults: { win: 2, lose: 3, draw: 1, resigned: 0 },
      topWeaknessTags: [],
    });
    expect(out).toContain("Insufficient pattern data this session");
    expect(out).toContain("do NOT speculate");
    expect(out).toContain("Analyze\nONLY the current game.");
  });

  it("still includes the gamesPlayed + W:L:D header in the hard-guard variant", () => {
    const out = buildCoachPrompt(["e4"], "lose", "medium", null, {
      gamesPlayed: 6,
      recentResults: { win: 2, lose: 3, draw: 1, resigned: 0 },
      topWeaknessTags: [],
    });
    expect(out).toContain("Player history (last 20 games): 6 games.");
    expect(out).toContain("Recent results: W:2 L:3 D:1.");
  });

  it("does NOT contain 'Recurring weakness areas:' line", () => {
    const out = buildCoachPrompt(["e4"], "lose", "medium", null, {
      gamesPlayed: 6,
      recentResults: { win: 2, lose: 3, draw: 1, resigned: 0 },
      topWeaknessTags: [],
    });
    expect(out).not.toContain("Recurring weakness areas:");
  });

  it("does NOT contain the standard 'Do not fabricate a pattern' call-out", () => {
    const out = buildCoachPrompt(["e4"], "lose", "medium", null, {
      gamesPlayed: 6,
      recentResults: { win: 2, lose: 3, draw: 1, resigned: 0 },
      topWeaknessTags: [],
    });
    expect(out).not.toContain("Do not fabricate a pattern");
  });
});

describe("truncateAtLimit", () => {
  it("returns text unchanged when within limit", () => {
    expect(truncateAtLimit("hello", 10)).toBe("hello");
    expect(truncateAtLimit("hello", 5)).toBe("hello");
  });

  it("truncates to exactly `max` characters with a trailing ellipsis", () => {
    const out = truncateAtLimit("a".repeat(700), 600);
    expect(out.length).toBe(600);
    expect(out.endsWith("…")).toBe(true);
    expect(out.slice(0, 599)).toBe("a".repeat(599));
  });

  it("handles empty input", () => {
    expect(truncateAtLimit("", 10)).toBe("");
  });
});

describe("buildCoachPrompt — 600-char augmentation cap", () => {
  it("v1 realistic max stays well under 600 chars", () => {
    // Worst case in v1: 3 fixed-label tags with high counts.
    const block = buildCoachPrompt(["e4"], "lose", "medium", null, {
      gamesPlayed: 20,
      recentResults: { win: 0, lose: 20, draw: 0, resigned: 0 },
      topWeaknessTags: [
        { tag: "weak-pawn-structure", count: 999 },
        { tag: "weak-king-safety", count: 888 },
        { tag: "endgame-conversion", count: 777 },
      ],
    });
    // Extract just the augmentation segment between "Player history" and the RESULT_HINTS line.
    const start = block.indexOf("Player history");
    const end = block.indexOf("\n\nThe player lost");
    const segment = block.slice(start, end);
    expect(segment.length).toBeLessThanOrEqual(600);
  });
});
