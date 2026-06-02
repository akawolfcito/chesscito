import { describe, expect, it } from "vitest";
import { EXERCISES, PLAYABLE_PIECES } from "@/lib/game/exercises";
import { EXERCISE_DESCRIPTIONS } from "@/lib/content/editorial";
import esMessages from "@/lib/content/messages/es";

/**
 * Regression guard: every Exercise.id playable in the UI must have a
 * description in both the EN catalog (`editorial.ts:EXERCISE_DESCRIPTIONS`)
 * and the ES catalog (`messages/es.ts:EXERCISE_DESCRIPTIONS`). next-intl
 * renders the raw key `EXERCISE_DESCRIPTIONS.<id>` when a translation is
 * missing — visible in the wild on the King section before this guard.
 */
describe("EXERCISE_DESCRIPTIONS catalog completeness", () => {
  const allIds = PLAYABLE_PIECES.flatMap((piece) =>
    EXERCISES[piece].map((ex) => ex.id),
  );

  it.each(allIds)("EN: %s has a description", (id) => {
    expect(EXERCISE_DESCRIPTIONS[id]).toBeTruthy();
  });

  it.each(allIds)("ES: %s has a description", (id) => {
    const esDescriptions = (esMessages as unknown as {
      EXERCISE_DESCRIPTIONS: Record<string, string>;
    }).EXERCISE_DESCRIPTIONS;
    expect(esDescriptions[id]).toBeTruthy();
  });
});
