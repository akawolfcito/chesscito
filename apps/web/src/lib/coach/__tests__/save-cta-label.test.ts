import { describe, it, expect } from "vitest";
import { saveCtaLabelKey } from "../save-cta-label";

// F8 phase (a) — single source of truth for the Save CTA label key.
// win keeps the celebratory "saveVictory"; every other outcome uses the
// neutral "saveMatch" (founder branding decision 2026-06-13).
describe("saveCtaLabelKey", () => {
  it("returns saveVictory for a win", () => {
    expect(saveCtaLabelKey("win")).toBe("saveVictory");
  });

  it("returns saveMatch for lose / draw / resigned", () => {
    expect(saveCtaLabelKey("lose")).toBe("saveMatch");
    expect(saveCtaLabelKey("draw")).toBe("saveMatch");
    expect(saveCtaLabelKey("resigned")).toBe("saveMatch");
  });
});
