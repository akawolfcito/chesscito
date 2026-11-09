// apps/web/src/lib/hub/__tests__/cta-tap.test.ts
//
// Spec: docs/specs/2026-08-07-daily-cta-content-loop.md (AC-10, AC-11, AC-12)
//
// The tap decision — WHERE to go and WHICH event to emit — is logic, not JSX.
// It lives here so it can be asserted without mounting the hub, and so the
// container cannot quietly grow a second copy of the rules.
import { describe, it, expect } from "vitest";
import { resolveCtaTap } from "@/lib/hub/cta-tap";
import type { ContentLoopVariant } from "@/lib/hub/content-loop";

const LEGACY_TARGET = "/exercises?piece=rook&legacy=1";

/** Deliberately NOT what any default would produce. An implementation that
 *  ignores the argument and recomputes a route still compiles and still
 *  navigates somewhere plausible — this value is what exposes it. */
const ODD_DESTINATION = "/exercises?piece=bishop&probe=cta-tap";

const ACTIONABLE: ContentLoopVariant[] = [
  "claim-pending",
  "continue-path",
  "labyrinth-ready",
  "improve-stars",
  "next-piece",
  "view-progress",
];

describe("resolveCtaTap — destination (AC-10, AC-11)", () => {
  it("hands back the destination it was given, verbatim", () => {
    for (const variant of ACTIONABLE) {
      const tap = resolveCtaTap({
        variant,
        destination: ODD_DESTINATION,
        legacyDestination: LEGACY_TARGET,
      });
      expect(tap.target).toBe(ODD_DESTINATION);
    }
  });

  // AC-11 — the one exception, and the reason it exists.
  it("overrides daily-pending with the historical route, never ?slot=daily", () => {
    const tap = resolveCtaTap({
      variant: "daily-pending",
      // What the Content Loop actually carries for this variant today.
      destination: "/exercises?slot=daily",
      legacyDestination: LEGACY_TARGET,
    });

    expect(tap.target).toBe(LEGACY_TARGET);
    expect(tap.target).not.toContain("slot=daily");
  });
});

describe("resolveCtaTap — telemetry (AC-12)", () => {
  // The historical series must stay comparable. If "Claim your gift" starts
  // emitting it, every before/after reading of hub_start_focus_tap silently
  // becomes apples-to-oranges, and nothing in the code would say so.
  it("reserves hub_start_focus_tap for the real start", () => {
    const tap = resolveCtaTap({
      variant: "daily-pending",
      destination: "/exercises?slot=daily",
      legacyDestination: LEGACY_TARGET,
    });

    expect(tap.event).toBe("hub_start_focus_tap");
    expect(tap.props).toEqual({ variant: "daily-pending" });
  });

  it("routes every other actionable variant to the new event, with its props", () => {
    for (const variant of ACTIONABLE) {
      const tap = resolveCtaTap({
        variant,
        destination: ODD_DESTINATION,
        legacyDestination: LEGACY_TARGET,
      });

      expect(tap.event).not.toBe("hub_start_focus_tap");
      expect(tap.event).toBe("hub_content_loop_cta_tap");
      // Not just the name: the props are what makes the event readable later.
      expect(tap.props).toEqual({ variant, destination: ODD_DESTINATION });
    }
  });

  // The destination reported to telemetry must be the one actually navigated
  // to, or the funnel describes a journey nobody took.
  it("reports the target it navigates to, not the one it was offered", () => {
    const tap = resolveCtaTap({
      variant: "daily-pending",
      destination: "/exercises?slot=daily",
      legacyDestination: LEGACY_TARGET,
    });
    expect(JSON.stringify(tap.props)).not.toContain("slot=daily");
  });
});
