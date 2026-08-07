// apps/web/src/lib/hub/__tests__/cta-slot.test.ts
//
// Spec: docs/specs/2026-08-07-daily-cta-content-loop.md (AC-8, AC-11)
//
// `toCtaSlotPresentation` is a truth table, so it is tested as one: a single
// parametrised run over ALL 10 Content Loop variants. Ten structurally different
// tests would hide the only property that matters here — that the mapping is
// total and that `kind` never disagrees with `destination`.
import { describe, it, expect } from "vitest";
import {
  toCtaSlotPresentation,
  usesLegacyDestination,
  LEGACY_DESTINATION_VARIANTS,
  type CtaLabelKey,
  type CtaNoteKey,
} from "@/lib/hub/cta-slot";
import type { ContentLoopAction, ContentLoopVariant } from "@/lib/hub/content-loop";

/** Builds an action without importing the private ACTIONS table: the mapping
 *  under test must not depend on the loop's own copy deck. */
function action(
  variant: ContentLoopVariant,
  destination: string | null,
): ContentLoopAction {
  return {
    variant,
    destination,
    // Deliberately WRONG-looking copy: `toCtaSlotPresentation` must never read
    // these. They travel outside next-intl and the bundle parity guard cannot
    // see them, so a presentation that surfaced them would ship untranslatable
    // strings. If any of these ever reaches a label, the assertions below fail.
    ctaEN: "RAW-EN-MUST-NOT-RENDER",
    ctaES: "RAW-ES-MUST-NOT-RENDER",
    subEN: "RAW-SUB-EN",
    subES: "RAW-SUB-ES",
  };
}

type Row = {
  variant: ContentLoopVariant;
  destination: string | null;
  kind: "action" | "status";
  labelKey: CtaLabelKey;
  noteKey: CtaNoteKey | null;
};

/** The whole contract, in one place. Mirrors the spec's variant → presentation
 *  table exactly; a diff here should always be a deliberate product change. */
const TABLE: Row[] = [
  {
    variant: "daily-pending",
    destination: "/exercises?slot=daily",
    kind: "action",
    labelKey: "ctaStartToday",
    noteKey: null,
  },
  {
    variant: "claim-pending",
    destination: "/trophies",
    kind: "action",
    labelKey: "ctaClaimGift",
    noteKey: null,
  },
  {
    variant: "continue-path",
    destination: "/exercises?piece=rook",
    kind: "action",
    labelKey: "ctaKeepTraining",
    noteKey: null,
  },
  {
    variant: "labyrinth-ready",
    destination: "/exercises?piece=bishop",
    kind: "action",
    labelKey: "ctaTryLabyrinth",
    noteKey: null,
  },
  {
    variant: "improve-stars",
    destination: "/exercises?piece=knight",
    kind: "action",
    labelKey: "ctaBeatScore",
    noteKey: null,
  },
  {
    variant: "next-piece",
    destination: "/exercises?piece=queen",
    kind: "action",
    labelKey: "ctaNewPiece",
    noteKey: null,
  },
  {
    variant: "view-progress",
    destination: "/trophies",
    kind: "action",
    labelKey: "ctaViewProgress",
    noteKey: null,
  },
  {
    variant: "daily-limit-reached",
    destination: null,
    kind: "status",
    labelKey: "ctaTomorrow",
    noteKey: "noteTrainingResumes",
  },
  {
    variant: "daily-max-reached",
    destination: null,
    kind: "status",
    labelKey: "ctaTomorrow",
    noteKey: "noteTrainingResumes",
  },
  {
    variant: "come-back-tomorrow",
    destination: null,
    kind: "status",
    labelKey: "ctaTomorrow",
    noteKey: "noteDailyReturns",
  },
];

describe("toCtaSlotPresentation", () => {
  it.each(TABLE)(
    "$variant → $kind ($labelKey)",
    ({ variant, destination, kind, labelKey, noteKey }) => {
      const result = toCtaSlotPresentation(action(variant, destination));

      expect(result.kind).toBe(kind);
      expect(result.variant).toBe(variant);
      expect(result.labelKey).toBe(labelKey);
      expect(result.noteKey).toBe(noteKey);
      expect(result.destination).toBe(destination);
    },
  );

  // AC-8: the table must cover the loop's whole variant space. A variant added
  // to content-loop.ts without a row here fails at compile time (the `never`
  // assertion inside the switch) — this asserts the TEST stays in step too,
  // because a compile error in src does not make a stale test fail.
  it("covers all 10 Content Loop variants exactly once", () => {
    const covered = TABLE.map((r) => r.variant);
    expect(new Set(covered).size).toBe(covered.length);
    expect(covered).toHaveLength(10);
  });

  // The discriminant is the whole point: a `status` carrying a destination
  // would let the card render a dead button, which is the defect being fixed.
  it("never yields a status with a destination, nor an action without one", () => {
    for (const row of TABLE) {
      const result = toCtaSlotPresentation(action(row.variant, row.destination));
      if (result.kind === "status") {
        expect(result.destination).toBeNull();
        expect(result.noteKey).not.toBeNull();
      } else {
        expect(result.destination).toBeTruthy();
        expect(result.noteKey).toBeNull();
      }
    }
  });

  // The loop's own ctaEN/ctaES must never surface: they bypass next-intl.
  it("never surfaces the raw copy carried by the action", () => {
    for (const row of TABLE) {
      const result = toCtaSlotPresentation(action(row.variant, row.destination));
      expect(result.labelKey).not.toMatch(/^RAW-/);
      expect(JSON.stringify(result)).not.toContain("MUST-NOT-RENDER");
    }
  });
});

describe("usesLegacyDestination (AC-11)", () => {
  it("covers daily-pending, and only daily-pending", () => {
    expect(usesLegacyDestination("daily-pending")).toBe(true);

    const others = TABLE.map((r) => r.variant).filter((v) => v !== "daily-pending");
    for (const variant of others) {
      expect(usesLegacyDestination(variant)).toBe(false);
    }
  });

  // Pins the debt: widening this list silently would move navigation for other
  // variants without anyone deciding it.
  it("declares exactly one legacy variant", () => {
    expect(LEGACY_DESTINATION_VARIANTS).toEqual(["daily-pending"]);
  });
});
