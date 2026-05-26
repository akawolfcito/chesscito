import { describe, it, expect } from "vitest";
import { routeCoachPreviewCta } from "../coach-preview-route";

describe("routeCoachPreviewCta", () => {
  it("PRO + credits=0 → 'ask' (unlimited bypasses counter)", () => {
    expect(routeCoachPreviewCta({ proActive: true, credits: 0 })).toBe("ask");
  });

  it("PRO + credits=42 → 'ask' (credits ignored when PRO)", () => {
    expect(routeCoachPreviewCta({ proActive: true, credits: 42 })).toBe("ask");
  });

  it("free + credits=3 → 'ask'", () => {
    expect(routeCoachPreviewCta({ proActive: false, credits: 3 })).toBe("ask");
  });

  it("free + credits=1 → 'ask' (last free analysis still routes to ask)", () => {
    expect(routeCoachPreviewCta({ proActive: false, credits: 1 })).toBe("ask");
  });

  it("free + credits=0 → 'paywall'", () => {
    expect(routeCoachPreviewCta({ proActive: false, credits: 0 })).toBe("paywall");
  });

  it("free + credits=-1 → 'paywall' (defensive: never treat negative as available)", () => {
    expect(routeCoachPreviewCta({ proActive: false, credits: -1 })).toBe("paywall");
  });
});
