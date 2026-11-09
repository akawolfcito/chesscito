import { describe, expect, it } from "vitest";
import { EXERCISES, PLAYABLE_PIECES } from "@/lib/game/exercises";
import { GENERATED_EXERCISE_DESCRIPTIONS } from "@/lib/game/generated/puzzles.generated";
import { EXERCISE_DESCRIPTIONS } from "@/lib/content/editorial";
import esMessages from "@/lib/content/messages/es";

/**
 * Regression guard: every Exercise.id playable in the UI must resolve to real
 * copy. next-intl renders the raw key `EXERCISE_DESCRIPTIONS.<id>` when a
 * translation is missing — visible in the wild on the King section before this
 * guard existed.
 *
 * There are now TWO legitimate sources, and `resolveExerciseDescription` tries
 * them in this order:
 *
 *   1. the CURATED title, compiled into GENERATED_EXERCISE_DESCRIPTIONS from
 *      content/exercises.json (A1) — this is where curated pieces live, and it
 *      is locale-independent, so the i18n catalogs are never consulted for them;
 *   2. the i18n label in EXERCISE_DESCRIPTIONS (EN + ES) — the scene-name labels
 *      that still carry the five uncurated pieces.
 *
 * So an id needs (1) OR (2), not both. Requiring both would force every curated
 * exercise to duplicate its title into two more files — the exact second source
 * of truth this cluster is retiring.
 */
describe("EXERCISE_DESCRIPTIONS catalog completeness", () => {
  const esDescriptions = (
    esMessages as unknown as { EXERCISE_DESCRIPTIONS: Record<string, string> }
  ).EXERCISE_DESCRIPTIONS;

  const allIds = PLAYABLE_PIECES.flatMap((piece) =>
    EXERCISES[piece].map((ex) => ex.id),
  );

  it.each(allIds)("%s resolves to real copy", (id) => {
    const curated = GENERATED_EXERCISE_DESCRIPTIONS[id];
    if (curated) {
      expect(curated).toBeTruthy();
      return; // curated copy wins before i18n is consulted — nothing else to prove
    }
    // Uncurated: the i18n catalogs are the only thing standing between the player
    // and a raw message key, so BOTH locales must carry it.
    expect(EXERCISE_DESCRIPTIONS[id], `EN missing for ${id}`).toBeTruthy();
    expect(esDescriptions[id], `ES missing for ${id}`).toBeTruthy();
  });
});
