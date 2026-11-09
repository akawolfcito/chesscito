import { describe, it, expect } from "vitest";
import { buildCoachPrompt } from "../prompt-template.js";

/**
 * H-4 contract tests — locale-aware prompt construction.
 *
 * The cache key in /api/coach/analyze stays (wallet, gameId) by design
 * (idempotency, no double credit charge on locale switch). These tests
 * cover the prompt template itself; the cache-key invariant is enforced
 * by leaving REDIS_KEYS.analysis unchanged and is not testable here.
 */
describe("buildCoachPrompt — H-4 locale contract", () => {
  const MOVES = ["e4", "e5", "Nf3"];

  it("defaults to EN behavior when no locale is supplied (backward compat with legacy callers)", () => {
    const withoutLocale = buildCoachPrompt(MOVES, "lose", "medium", null);
    const withEn = buildCoachPrompt(MOVES, "lose", "medium", null, undefined, "en");
    expect(withoutLocale).toBe(withEn);
    // Sanity: EN markers present
    expect(withoutLocale).toContain("You are a chess coach");
    expect(withoutLocale).toContain("Result: lose");
    expect(withoutLocale).toContain("All text in English");
  });

  it("locale=\"es\" swaps the intro, RESULT_HINTS, and rule block to Spanish", () => {
    const out = buildCoachPrompt(MOVES, "lose", "medium", null, undefined, "es");
    expect(out).toContain("Eres un coach de ajedrez");
    expect(out).toContain("El jugador perdió. Sé alentador.");
    expect(out).toContain("Reglas:");
    expect(out).toContain("Partida:");
    expect(out).toContain("Resultado: perdiste");
  });

  it("locale=\"es\" preserves the English JSON schema keys (anti-JSON-break guard)", () => {
    const out = buildCoachPrompt(MOVES, "lose", "medium", null, undefined, "es");
    // Schema keys MUST stay English so normalizeCoachResponse can parse.
    expect(out).toContain('"kind": "full"');
    expect(out).toContain('"summary":');
    expect(out).toContain('"mistakes":');
    expect(out).toContain('"lessons":');
    expect(out).toContain('"praise":');
    expect(out).toContain('"moveNumber"');
    expect(out).toContain('"played"');
    expect(out).toContain('"better"');
    expect(out).toContain('"explanation"');
    // Explicit rule that locks this guarantee
    expect(out).toContain("JSON property names MUST remain in English");
  });

  it("locale=\"es\" translates the PRO history augmentation block", () => {
    const out = buildCoachPrompt(MOVES, "lose", "medium", null, {
      gamesPlayed: 14,
      recentResults: { win: 5, lose: 7, draw: 1, resigned: 1 },
      topWeaknessTags: [{ tag: "weak-king-safety", count: 4 }],
    }, "es");
    expect(out).toContain("Historial del jugador (últimas 20 partidas): 14 partidas.");
    expect(out).toContain("Resultados recientes: V:5 D:7 E:1.");
    expect(out).toContain("Áreas de debilidad recurrentes:");
    expect(out).toContain("No inventes un patrón que no esté en los datos.");
  });

  it("locale=\"es\" renders the no-evidence guard in Spanish when topWeaknessTags is empty", () => {
    const out = buildCoachPrompt(MOVES, "lose", "medium", null, {
      gamesPlayed: 6,
      recentResults: { win: 2, lose: 3, draw: 1, resigned: 0 },
      topWeaknessTags: [],
    }, "es");
    expect(out).toContain("Datos de patrones insuficientes esta sesión");
    expect(out).toContain("NO especules");
    expect(out).toContain("ÚNICAMENTE la partida actual");
  });
});
