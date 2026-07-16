/**
 * Drawer row titles for the Special Training lane.
 *
 * Extracted from <ExercisesScreen> so this can be TESTED. It was inline when the
 * Knight's Tour shipped its title in English to Spanish players (fix 162ea1ae),
 * and that fix landed with no test — the routing lived inside a 3000-line
 * component, so there was nothing cheap to assert against. Every signature game
 * added since is one more chance to reintroduce the same silent bug.
 *
 * ⚠️ THE BUG THIS EXISTS TO PREVENT: `entry.title` is the AUTHORING copy from
 * content/*.json — English, always. A game whose id is not claimed by any lane
 * falls back to it and ships an English row to Spanish players. That reads as
 * content, not as a bug: the row IS titled, just in the wrong language, so
 * nothing looks broken and nobody reports it.
 */
import type { Exercise } from "@/lib/game/types";

/** One signature game's ids plus the translator that owns their titles. */
export type LabelLane = {
  ids: ReadonlySet<string>;
  /** Resolves a level id to its localized title. Throws/returns a fallback key
   *  per the i18n layer's own contract — this module does not second-guess it. */
  translate: (id: string) => string;
};

/**
 * Title per entry id. A lane claims an id → its translator owns the title.
 * Unclaimed ids fall back to the authored `entry.title` (correct for raw
 * labyrinths, which are not localized and carry no signature-game copy).
 * First matching lane wins; ids never overlap across pools in practice.
 */
export function resolveSpecialTrainingLabels(
  entries: readonly Exercise[],
  lanes: readonly LabelLane[],
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const entry of entries) {
    const lane = lanes.find((l) => l.ids.has(entry.id));
    const title = lane ? lane.translate(entry.id) : entry.title;
    if (title) out[entry.id] = title;
  }
  return out;
}

/**
 * The ids in `entries` that no lane claims — i.e. the rows that will render
 * authoring copy. Exported for the guard test: a signature game in here is the
 * 162ea1ae bug, before a player ever sees it.
 */
export function unlocalizedIds(
  entries: readonly Exercise[],
  lanes: readonly LabelLane[],
): string[] {
  return entries
    .filter((e) => !lanes.some((l) => l.ids.has(e.id)))
    .map((e) => e.id);
}
