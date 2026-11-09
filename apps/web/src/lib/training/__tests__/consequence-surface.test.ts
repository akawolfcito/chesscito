import { describe, expect, it } from "vitest";

import { CONSEQUENCE_COPY } from "@/lib/content/editorial";
import es from "@/lib/content/messages/es";
import {
  consequenceMessage,
  type TrainingConsequence,
} from "@/lib/training/consequence";

/**
 * PART 2 — the consequence line is SURFACE-AWARE, never suppressed.
 *
 * The founder's rule (2026-08-19): "No ocultar recompensas ganadas; sí evitar
 * que su copy empuje al usuario hacia Exercises o haga parecer que sigue en el
 * carril de ejercicios."
 *
 * So a featured mini-game completion still ANNOUNCES what it earned — it just
 * says it without the exercise-path navigation tail. The three offending tails
 * are pinned here BY READING THE COPY, not by asserting a key: a translator
 * putting "en Ejercicios" back into the mini-game string is exactly the
 * regression this file exists to catch, and a key assertion would sail past it.
 */

/** Every phrase that tells the player they are on the exercise path. Checked
 *  case-insensitively against both bundles. */
const PATH_TAILS_EN = [
  "pick your next piece",
  "on your path",
  "in exercises",
];
const PATH_TAILS_ES = [
  "elige tu próxima pieza",
  "en tu camino",
  "en ejercicios",
];

/** The consequences a LABYRINTH completion can actually produce. `badge_progress`
 *  is deliberately absent: `resolveConsequence` only emits it for
 *  `completed.kind === "exercise"`, so it can never reach a featured overlay. */
const LABYRINTH_CONSEQUENCES: TrainingConsequence[] = [
  { kind: "mastery" },
  { kind: "challenge_unlocked", nodeId: "rook-lab-2" },
  { kind: "lane_progress", done: 2, total: 4 },
  { kind: "lane_progress", done: 4, total: 4 },
];

function renderEn(consequence: TrainingConsequence, surface: Parameters<typeof consequenceMessage>[1]) {
  const message = consequenceMessage(consequence, surface);
  return CONSEQUENCE_COPY[message.key];
}

function renderEs(consequence: TrainingConsequence, surface: Parameters<typeof consequenceMessage>[1]) {
  const message = consequenceMessage(consequence, surface);
  return es.CONSEQUENCE_COPY[message.key];
}

describe("consequenceMessage — surface awareness", () => {
  it("defaults to the exercise path, so every existing caller is unchanged", () => {
    expect(consequenceMessage({ kind: "mastery" })).toEqual(
      consequenceMessage({ kind: "mastery" }, "exercise_path"),
    );
    expect(consequenceMessage({ kind: "mastery" })).toEqual({ key: "mastery" });
    expect(consequenceMessage({ kind: "lane_progress", done: 2, total: 4 })).toEqual({
      key: "laneProgress",
      values: { done: 2, total: 4 },
    });
    expect(consequenceMessage({ kind: "lane_progress", done: 4, total: 4 })).toEqual({
      key: "laneComplete",
    });
  });

  it("STILL ANNOUNCES every earned consequence on the mini-game surface", () => {
    // The whole point of the correction: a featured completion is not silent.
    for (const consequence of LABYRINTH_CONSEQUENCES) {
      const message = consequenceMessage(consequence, "featured_minigame");
      expect(message.key, `${consequence.kind} produced no key`).toBeTruthy();
      expect(renderEn(consequence, "featured_minigame")).toBeTruthy();
      expect(renderEs(consequence, "featured_minigame")).toBeTruthy();
    }
  });

  it("drops the exercise-path tail from the mini-game copy (EN)", () => {
    for (const consequence of LABYRINTH_CONSEQUENCES) {
      const text = renderEn(consequence, "featured_minigame").toLowerCase();
      for (const tail of PATH_TAILS_EN) {
        expect(text, `${consequence.kind} still says "${tail}"`).not.toContain(tail);
      }
    }
  });

  it("drops the exercise-path tail from the mini-game copy (ES)", () => {
    for (const consequence of LABYRINTH_CONSEQUENCES) {
      const text = renderEs(consequence, "featured_minigame").toLowerCase();
      for (const tail of PATH_TAILS_ES) {
        expect(text, `${consequence.kind} still says "${tail}"`).not.toContain(tail);
      }
    }
  });

  it("KEEPS the exercise-path tail where it belongs — this is not a copy deletion", () => {
    // If these ever go green-by-vacuum (someone "simplified" the path copy to
    // match the mini-game one), the surface distinction has quietly stopped
    // existing and the tests above would still pass.
    expect(renderEn({ kind: "mastery" }, "exercise_path").toLowerCase()).toContain(
      "pick your next piece",
    );
    expect(
      renderEn({ kind: "challenge_unlocked", nodeId: "x" }, "exercise_path").toLowerCase(),
    ).toContain("on your path");
    expect(
      renderEn({ kind: "lane_progress", done: 4, total: 4 }, "exercise_path").toLowerCase(),
    ).toContain("in exercises");
  });

  it("badge_progress is surface-independent — its copy names no destination", () => {
    const path = consequenceMessage({ kind: "badge_progress", done: 3, required: 8 });
    const featured = consequenceMessage(
      { kind: "badge_progress", done: 3, required: 8 },
      "featured_minigame",
    );
    expect(featured).toEqual(path);
  });

  it("every key the resolver can emit exists in BOTH bundles", () => {
    for (const surface of ["exercise_path", "featured_minigame"] as const) {
      for (const consequence of [
        ...LABYRINTH_CONSEQUENCES,
        { kind: "badge_progress", done: 3, required: 8 } as const,
      ]) {
        const { key } = consequenceMessage(consequence, surface);
        expect(CONSEQUENCE_COPY[key], `EN missing ${key}`).toBeTruthy();
        expect(es.CONSEQUENCE_COPY[key], `ES missing ${key}`).toBeTruthy();
      }
    }
  });
});
