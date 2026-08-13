/**
 * The linter's save-time advice, sorted into kinds that carry different
 * obligations.
 *
 * ⚠️ Why not a severity filter, which is the obvious thing to build: the
 * warnings channel contains NO errors. Errors block the save and never reach it
 * (`lintPieceSequence` returns `errors: []` as its documented contract, and
 * `lintPuzzle`'s errors fail the build). Filtering "warning / error / info" over
 * a list that is 100% warnings filters one bucket into itself — decoration
 * replacing decoration.
 *
 * ⛔ The thing actually missing was never a filter. It was an ANSWER to "what
 * treatment does this deserve?", and the honest answer is uncomfortable: two of
 * the three kinds are advisory by an explicit product decision, and the third is
 * known to be wrong on Star Sweep boards. Saying that out loud is what turns the
 * panel from noise into something readable — a warning whose standing you cannot
 * look up is a warning you learn to skip.
 */

export type WarningKind = "pacing" | "decorative" | "other";

export type ClassifiedWarning = { kind: WarningKind; text: string };

export type WarningGuidance = {
  label: string;
  /** What to DO about it — the field the whole module exists for. */
  treatment: string;
  /** A known limit of this check, when it has one. */
  caveat?: string;
};

export const WARNING_GUIDANCE: Record<WarningKind, WarningGuidance> = {
  pacing: {
    label: "Difficulty curve",
    treatment:
      "Advice, never a blocker. A curve is a judgement about teaching, not a " +
      "fact decidable from a board — overrule it whenever the lesson calls for " +
      "it, and do not reorder content just to silence it.",
  },
  decorative: {
    label: "Decorative obstacles",
    treatment:
      "Read it, then check the board yourself before dropping anything. It " +
      "compares each obstacle against the optimal move count, optimal routes " +
      "and first-move choices.",
    caveat:
      "⚠️ Unreliable on a Star Sweep: it judges the route to ONE goal, so on a " +
      "sweep it has already called 9 of 10 walls decorative on walls that " +
      "quadrupled the real route. Ignore it there.",
  },
  other: {
    label: "Unclassified",
    treatment:
      "A warning this panel has not been taught to recognise. It is shown " +
      "verbatim rather than filed under a kind whose guidance may not apply — " +
      "if these become common, give them a kind.",
  },
};

/**
 * Which kind a warning is.
 *
 * ⚠️ Matches on the linter's own stable lead phrases, and the test proves the
 * match by running the REAL linter and classifying what it actually returns —
 * so a reworded message goes red here instead of silently falling to `other`.
 *
 * ⛔ Unrecognised text stays `other` on purpose. Guessing a kind hands a warning
 * guidance that was written for a different check, which is worse than saying
 * "this one is new".
 */
export function classifyWarning(text: string): WarningKind {
  if (/\bthe curve (goes backwards|jumps)\b/.test(text)) return "pacing";
  if (/\bobstacles are decorative\b/.test(text)) return "decorative";
  return "other";
}

/** Tag every warning, in input order. ⚠️ Never drops one: a filter that loses a
 *  warning is strictly worse than the unfiltered wall it replaced. */
export function groupWarnings(warnings: readonly string[]): ClassifiedWarning[] {
  return warnings.map((text) => ({ kind: classifyWarning(text), text }));
}

/** How many of each kind, for the filter chips. */
export function countByKind(
  warnings: readonly ClassifiedWarning[],
): Record<WarningKind, number> {
  const counts: Record<WarningKind, number> = {
    pacing: 0,
    decorative: 0,
    other: 0,
  };
  for (const w of warnings) counts[w.kind] += 1;
  return counts;
}

/** The plain-text block the popup's copy button puts on the clipboard. Grouped
 *  by kind and carrying the guidance, so what gets pasted into a note is
 *  self-explanatory instead of a wall of orphan sentences. */
export function warningsAsText(
  warnings: readonly ClassifiedWarning[],
): string {
  const kinds: WarningKind[] = ["pacing", "decorative", "other"];
  return kinds
    .filter((k) => warnings.some((w) => w.kind === k))
    .map((k) => {
      const guidance = WARNING_GUIDANCE[k];
      const lines = warnings
        .filter((w) => w.kind === k)
        .map((w) => `- ${w.text}`)
        .join("\n");
      return (
        `## ${guidance.label}\n${guidance.treatment}` +
        (guidance.caveat ? `\n${guidance.caveat}` : "") +
        `\n\n${lines}`
      );
    })
    .join("\n\n");
}
