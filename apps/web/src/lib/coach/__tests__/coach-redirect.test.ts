import { describe, expect, it } from "vitest";
import { shouldRedirectToCoachViewer } from "../coach-redirect";

// Plan 2 (Render-A) — the arena→/coach/[id] redirect must fire ONLY when a
// persisted `full` analysis exists (phase "result"). The client-only quick
// review (phase "fallback") is NOT persisted, so redirecting on it lands the
// user on an empty Match Review. This predicate guards that bug.

describe("shouldRedirectToCoachViewer", () => {
  const full = { kind: "full" as const, summary: "g", mistakes: [], lessons: [], praise: [] };

  it("redirects on a persisted full result", () => {
    expect(shouldRedirectToCoachViewer("result", full)).toBe(true);
  });

  it("does NOT redirect on fallback (client-only quick review, never persisted)", () => {
    expect(shouldRedirectToCoachViewer("fallback", full)).toBe(false);
    expect(shouldRedirectToCoachViewer("fallback", null)).toBe(false);
  });

  it("does NOT redirect on result with a missing or non-full response", () => {
    expect(shouldRedirectToCoachViewer("result", null)).toBe(false);
    expect(
      shouldRedirectToCoachViewer("result", { kind: "basic" } as never),
    ).toBe(false);
  });

  it("does NOT redirect on transient phases", () => {
    expect(shouldRedirectToCoachViewer("idle", full)).toBe(false);
    expect(shouldRedirectToCoachViewer("loading", full)).toBe(false);
    expect(shouldRedirectToCoachViewer("paywall", full)).toBe(false);
  });
});
