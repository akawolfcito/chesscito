import { describe, it, expect } from "vitest";
import {
  shouldFireStarsConnectPrompt,
  shouldFireLocalSavedToast,
  shouldShowWPCtaInSlot,
} from "../exercises-save-flow-logic";

describe("shouldFireStarsConnectPrompt", () => {
  it("returns false in Lite even when disconnected and 3-star (suppressed in Lite)", () => {
    // Spec: starsConnectPrompt is suppressed in Lite — score-save is local-only.
    expect(
      shouldFireStarsConnectPrompt({ isConnected: false, liteMode: true, stars: 3 }),
    ).toBe(false);
  });

  it("returns true in Full when disconnected and player earns 3 stars", () => {
    // Full behavior preserved: connect prompt fires for score-save incentive.
    expect(
      shouldFireStarsConnectPrompt({ isConnected: false, liteMode: false, stars: 3 }),
    ).toBe(true);
  });

  it("returns false in Full when already connected", () => {
    expect(
      shouldFireStarsConnectPrompt({ isConnected: true, liteMode: false, stars: 3 }),
    ).toBe(false);
  });

  it("returns false in Full when stars < 3", () => {
    expect(
      shouldFireStarsConnectPrompt({ isConnected: false, liteMode: false, stars: 2 }),
    ).toBe(false);
  });
});

describe("shouldFireLocalSavedToast", () => {
  it("returns true in exercise mode (not labyrinth) — normal path", () => {
    // Toast fires at t=1500ms (inside autoReset.schedule) after WELL DONE flash.
    // Both the normal-advance path and the badge-earned path call this guard.
    expect(shouldFireLocalSavedToast({ labyrinthMode: false })).toBe(true);
  });

  it("returns true in badge-earned path (not labyrinth) — badge-unlock route", () => {
    // After the fix: nested autoReset.schedule fires this at t=1500ms even when
    // the badge overlay appears, before the 13.5s safety-net.
    expect(shouldFireLocalSavedToast({ labyrinthMode: false })).toBe(true);
  });

  it("returns false in labyrinth mode — labyrinth overlay handles its own feedback", () => {
    // Spec P0-3: guard labyrinthMode so labyrinths don't get the exercise toast.
    expect(shouldFireLocalSavedToast({ labyrinthMode: true })).toBe(false);
  });
});

describe("shouldShowWPCtaInSlot", () => {
  const baseOpts = {
    liteMode: true,
    contextAction: null,
    wpMounted: true,
    wpState: "idle",
  } as const;

  it("returns true in Lite when slot is idle and pack not claimed", () => {
    expect(shouldShowWPCtaInSlot(baseOpts)).toBe(true);
  });

  it("returns true when wpState is 'connect' (wallet not connected yet)", () => {
    expect(shouldShowWPCtaInSlot({ ...baseOpts, wpState: "connect" })).toBe(true);
  });

  it("returns true when wpState is 'claiming' (in-flight)", () => {
    expect(shouldShowWPCtaInSlot({ ...baseOpts, wpState: "claiming" })).toBe(true);
  });

  it("returns false when pack is already claimed", () => {
    expect(shouldShowWPCtaInSlot({ ...baseOpts, wpState: "claimed" })).toBe(false);
  });

  it("returns false when contextAction is non-null — badge CTA takes priority", () => {
    // Spec: badge claim > WP CTA. getContextAction returns "claimBadge" when
    // badgeClaimable, so contextAction !== null → WP slot hidden.
    expect(
      shouldShowWPCtaInSlot({ ...baseOpts, contextAction: "claimBadge" }),
    ).toBe(false);
  });

  it("returns false in Full mode (liteMode=false) — WP inline CTA is Lite-only", () => {
    expect(
      shouldShowWPCtaInSlot({ ...baseOpts, liteMode: false }),
    ).toBe(false);
  });

  it("returns false before hydration (wpMounted=false) — SSR safety guard", () => {
    expect(
      shouldShowWPCtaInSlot({ ...baseOpts, wpMounted: false }),
    ).toBe(false);
  });
});
