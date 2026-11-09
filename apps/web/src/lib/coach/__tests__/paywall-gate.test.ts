import { describe, it, expect } from "vitest";
import { shouldShowPaywall } from "../paywall-gate";

describe("shouldShowPaywall", () => {
  it("free user with credits → no paywall", () => {
    expect(shouldShowPaywall({ proActive: false, credits: 3 })).toBe(false);
  });

  it("free user without credits → paywall", () => {
    expect(shouldShowPaywall({ proActive: false, credits: 0 })).toBe(true);
  });

  it("PRO user with 0 credits → no paywall (PRO bypasses credit check)", () => {
    expect(shouldShowPaywall({ proActive: true, credits: 0 })).toBe(false);
  });

  it("PRO user with credits → no paywall", () => {
    expect(shouldShowPaywall({ proActive: true, credits: 5 })).toBe(false);
  });

  it("negative credits sentinel treated as zero", () => {
    expect(shouldShowPaywall({ proActive: false, credits: -1 })).toBe(true);
  });
});
