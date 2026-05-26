import { describe, it, expect } from "vitest";
import { COACH_ONBOARDING_COPY } from "@/lib/content/editorial";
import esBundle from "@/lib/content/messages/es";

const OUTCOMES = ["win", "lose", "draw"] as const;

describe("COACH_ONBOARDING_COPY (editorial / EN canonical)", () => {
  it("publishes intros for all three Arena outcomes", () => {
    expect(Object.keys(COACH_ONBOARDING_COPY.intros)).toEqual(
      expect.arrayContaining([...OUTCOMES]),
    );
  });

  it("ships non-empty intro strings for each outcome", () => {
    for (const outcome of OUTCOMES) {
      expect(COACH_ONBOARDING_COPY.intros[outcome].length).toBeGreaterThan(0);
    }
  });

  it("ships non-empty CTA labels (accept + decline)", () => {
    expect(COACH_ONBOARDING_COPY.ctaAccept.length).toBeGreaterThan(0);
    expect(COACH_ONBOARDING_COPY.ctaDecline.length).toBeGreaterThan(0);
  });

  it("anchors Luz's voice in first person across every EN intro", () => {
    for (const outcome of OUTCOMES) {
      const intro = COACH_ONBOARDING_COPY.intros[outcome];
      expect(intro).toMatch(/I'm Luz/);
      expect(intro).toMatch(/I watched your game/);
    }
  });

  it("carries no em-dashes or en-dashes (anti-AI prose hard rule)", () => {
    const blob = [
      ...Object.values(COACH_ONBOARDING_COPY.intros),
      COACH_ONBOARDING_COPY.ctaAccept,
      COACH_ONBOARDING_COPY.ctaDecline,
    ].join(" ");
    expect(blob).not.toMatch(/[—–]/);
  });
});

describe("COACH_ONBOARDING_COPY (ES mirror in messages/es.ts)", () => {
  const es = (esBundle as unknown as {
    COACH_ONBOARDING_COPY: typeof COACH_ONBOARDING_COPY;
  }).COACH_ONBOARDING_COPY;

  it("overrides the full shape (intros + CTA labels)", () => {
    expect(Object.keys(es.intros)).toEqual(expect.arrayContaining([...OUTCOMES]));
    expect(es.ctaAccept.length).toBeGreaterThan(0);
    expect(es.ctaDecline.length).toBeGreaterThan(0);
  });

  it("anchors Luz's voice in first person across every ES intro", () => {
    for (const outcome of OUTCOMES) {
      const intro = es.intros[outcome];
      expect(intro).toMatch(/soy Luz/);
      expect(intro).toMatch(/Vi tu partida/);
    }
  });

  it("carries no em-dashes or en-dashes (anti-AI prose hard rule)", () => {
    const blob = [
      ...Object.values(es.intros),
      es.ctaAccept,
      es.ctaDecline,
    ].join(" ");
    expect(blob).not.toMatch(/[—–]/);
  });
});
