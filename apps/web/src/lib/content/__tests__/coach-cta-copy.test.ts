import { describe, it, expect } from "vitest";
import { COACH_CTA_COPY } from "@/lib/content/editorial";
import esBundle from "@/lib/content/messages/es";
import enBundle from "@/lib/content/messages/en";

type CtaBundle = {
  COACH_CTA_COPY: {
    askWithCounter: string;
    askWhenZero: string;
  };
};

describe("COACH_CTA_COPY (editorial / EN canonical)", () => {
  it("exposes askWithCounter as a function returning a non-empty string", () => {
    expect(typeof COACH_CTA_COPY.askWithCounter).toBe("function");
    expect(COACH_CTA_COPY.askWithCounter(2).length).toBeGreaterThan(0);
  });

  it("interpolates the credit count", () => {
    const out = COACH_CTA_COPY.askWithCounter(2);
    expect(out).toContain("2");
  });

  it("references Luz by name in both variants", () => {
    expect(COACH_CTA_COPY.askWithCounter(1)).toMatch(/\bLuz\b/);
    expect(COACH_CTA_COPY.askWhenZero).toMatch(/\bLuz\b/);
  });

  it("askWhenZero mentions both fallback paths (PRO + pack)", () => {
    const lower = COACH_CTA_COPY.askWhenZero.toLowerCase();
    expect(lower).toMatch(/pro/);
    expect(lower).toMatch(/pack/);
  });

  it("carries no em-dashes or en-dashes (anti-AI prose hard rule)", () => {
    const blob = `${COACH_CTA_COPY.askWithCounter(2)} ${COACH_CTA_COPY.askWhenZero}`;
    expect(blob).not.toMatch(/[—–]/);
  });
});

describe("COACH_CTA_COPY ICU mirror in messages/en.ts", () => {
  const en = enBundle as unknown as CtaBundle;

  it("publishes an ICU placeholder for the credit count", () => {
    expect(en.COACH_CTA_COPY.askWithCounter).toContain("{count}");
  });

  it("mirror references Luz", () => {
    expect(en.COACH_CTA_COPY.askWithCounter).toMatch(/\bLuz\b/);
  });

  it("mirror carries no em/en-dashes", () => {
    expect(en.COACH_CTA_COPY.askWithCounter).not.toMatch(/[—–]/);
  });
});

describe("COACH_CTA_COPY ES override in messages/es.ts", () => {
  const es = esBundle as unknown as CtaBundle;

  it("publishes an ICU placeholder for the credit count", () => {
    expect(es.COACH_CTA_COPY.askWithCounter).toContain("{count}");
  });

  it("uses voseo verb form and references Luz", () => {
    expect(es.COACH_CTA_COPY.askWithCounter).toMatch(/Pedile/);
    expect(es.COACH_CTA_COPY.askWithCounter).toMatch(/\bLuz\b/);
    expect(es.COACH_CTA_COPY.askWhenZero).toMatch(/\bLuz\b/);
  });

  it("askWhenZero ES mentions PRO + pack fallbacks", () => {
    const lower = es.COACH_CTA_COPY.askWhenZero.toLowerCase();
    expect(lower).toMatch(/pro/);
    expect(lower).toMatch(/pack/);
  });

  it("carries no em/en-dashes", () => {
    const blob = `${es.COACH_CTA_COPY.askWithCounter} ${es.COACH_CTA_COPY.askWhenZero}`;
    expect(blob).not.toMatch(/[—–]/);
  });
});
