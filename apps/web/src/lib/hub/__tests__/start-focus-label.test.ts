import { describe, expect, it } from "vitest";

import type { ContentLoopVariant } from "@/lib/hub/content-loop";
import { startFocusLabelKey } from "@/lib/hub/start-focus-label";

describe("startFocusLabelKey", () => {
  it("null (pre-hydration) → safe default 'startFocus'", () => {
    expect(startFocusLabelKey(null)).toBe("startFocus");
  });

  it("at-limit variants → 'practice' (never a dead tap)", () => {
    expect(startFocusLabelKey("daily-limit-reached")).toBe("practice");
    expect(startFocusLabelKey("daily-max-reached")).toBe("practice");
    expect(startFocusLabelKey("come-back-tomorrow")).toBe("practice");
  });

  it("fresh / first-visit variants → 'startFocus'", () => {
    expect(startFocusLabelKey("daily-pending")).toBe("startFocus");
    expect(startFocusLabelKey("continue-path")).toBe("startFocus");
    expect(startFocusLabelKey("view-progress")).toBe("startFocus");
  });

  it("mid-progress variants → 'continue'", () => {
    expect(startFocusLabelKey("claim-pending")).toBe("continue");
    expect(startFocusLabelKey("labyrinth-ready")).toBe("continue");
    expect(startFocusLabelKey("improve-stars")).toBe("continue");
    expect(startFocusLabelKey("next-piece")).toBe("continue");
  });

  it("maps every ContentLoopVariant (exhaustive — no undefined)", () => {
    const all: ContentLoopVariant[] = [
      "daily-pending",
      "claim-pending",
      "daily-limit-reached",
      "daily-max-reached",
      "continue-path",
      "labyrinth-ready",
      "improve-stars",
      "next-piece",
      "come-back-tomorrow",
      "view-progress",
    ];
    for (const v of all) {
      expect(["startFocus", "continue", "practice"]).toContain(startFocusLabelKey(v));
    }
  });
});
