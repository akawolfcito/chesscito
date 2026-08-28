/**
 * Unit tests for the evaluateXClose state machine.
 *
 * Imports directly from the dedicated pure-logic module (end-state-close-policy.ts)
 * rather than from page.tsx, which avoids pulling in the full React component
 * tree and all its module-level side-effects (lottie canvas, wagmi, etc.).
 *
 * 2026-08-28 — the X is a CLOSE, not a navigation. Every branch that used to
 * push the player deeper (into /coach/[gameId], /coach/history or the DUEL
 * selector) now exits to the PLAY hub. Measured before the change: 93,3% of
 * 2.064 `arena_x_close_fired` pushed to the Match Reviewer — the "get me out
 * of here" gesture was the single biggest entry point INTO the review funnel.
 * See docs/audits/2026-08-28-core-loop-diagnostic.md §C.3.
 *
 * The two non-push branches are deliberately preserved: they protect an
 * in-flight mint and an in-flight persist respectively.
 */

import { describe, expect, it } from "vitest";
import { evaluateXClose, PLAY_HUB_HREF } from "../end-state-close-policy";

describe("evaluateXClose state machine", () => {
  it("exposes the PLAY hub as the single close destination", () => {
    expect(PLAY_HUB_HREF).toBe("/");
  });

  it.each(["idle", "persisted", "failed", "dismissed"] as const)(
    "%s → push to the PLAY hub",
    (persistState) => {
      expect(evaluateXClose({ persistState, claimPhase: "ready" })).toEqual({
        type: "push",
        href: PLAY_HUB_HREF,
      });
    },
  );

  it("NEVER pushes to the Match Reviewer, the Journal or the DUEL selector", () => {
    const states = ["idle", "persisted", "failed", "dismissed"] as const;
    for (const persistState of states) {
      const effect = evaluateXClose({ persistState, claimPhase: "ready" });
      expect(effect.type).toBe("push");
      if (effect.type !== "push") continue;
      expect(effect.href).not.toContain("/coach");
      expect(effect.href).not.toContain("/arena");
    }
  });

  it("persisting → set-pending, so the /api/games POST is never aborted mid-flight", () => {
    expect(evaluateXClose({
      persistState: "persisting",
      claimPhase: "ready",
    })).toEqual({ type: "set-pending" });
  });

  it("claiming → noop (X stays locked while the mint is in flight)", () => {
    expect(evaluateXClose({
      persistState: "persisted",
      claimPhase: "claiming",
    })).toEqual({ type: "noop" });
  });

  it("claiming wins over every persist state", () => {
    const states = ["idle", "persisting", "persisted", "failed", "dismissed"] as const;
    for (const persistState of states) {
      expect(evaluateXClose({ persistState, claimPhase: "claiming" })).toEqual({
        type: "noop",
      });
    }
  });
});
