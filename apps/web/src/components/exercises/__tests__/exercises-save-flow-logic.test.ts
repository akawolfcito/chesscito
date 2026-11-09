import { beforeEach, describe, it, expect, vi } from "vitest";

// The gift is a Lite-only product and `unlockWelcomePackageGift` returns early
// in Full mode. Tests default to Full, so the writer would be a no-op and every
// assertion below would pass vacuously. The pure helpers in this file take
// `liteMode` as a parameter and are untouched by this mock.
vi.mock("@/lib/feature-flags", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/feature-flags")>();
  return { ...actual, CHESSCITO_MODE: "learn" as const, CHESSCITO_LITE_MODE: true };
});

const {
  shouldFireStarsConnectPrompt,
  shouldFireLocalSavedToast,
  shouldShowWPCtaInSlot,
  unlockWelcomePackageGift,
} = await import("../exercises-save-flow-logic");
const { getWelcomePackageState, setWelcomePackageState } = await import(
  "@/lib/welcome-package/storage"
);

/**
 * `unlockWelcomePackageGift()` is the SINGLE writer of `welcomePackage.unlocked`
 * — `useWelcomePackage().unlock()` was dead code and is gone. Nothing had ever
 * covered it directly: the idempotence guard it inherited (`if (prev.unlocked)
 * return`) lost its only test along with the API that used to share it.
 *
 * It is called on EVERY resolve where `first-reward` is on disk, not just the
 * one that earned it. Without the guard, every subsequent solve would re-date
 * `unlockedAt` — the timestamp would track the player's last exercise instead
 * of the moment they earned the gift.
 */
describe("unlockWelcomePackageGift", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("unlocks a gift that has never been unlocked", () => {
    unlockWelcomePackageGift();

    const state = getWelcomePackageState();
    expect(state.unlocked).toBe(true);
    expect(state.unlockedAt).toBeTruthy();
  });

  it("is idempotent — a second call does not overwrite unlockedAt", () => {
    unlockWelcomePackageGift();
    const first = getWelcomePackageState().unlockedAt;

    unlockWelcomePackageGift();

    expect(getWelcomePackageState().unlockedAt).toBe(first);
  });

  it("never re-dates an unlock that arrived from somewhere else", () => {
    const original = "2020-01-01T00:00:00.000Z";
    setWelcomePackageState({
      ...getWelcomePackageState(),
      unlocked: true,
      unlockedAt: original,
    });

    unlockWelcomePackageGift();

    expect(getWelcomePackageState().unlockedAt).toBe(original);
  });

  it("leaves a CLAIMED gift untouched — it cannot un-claim or re-unlock it", () => {
    unlockWelcomePackageGift();
    setWelcomePackageState({
      ...getWelcomePackageState(),
      claimed: true,
      claimedAt: new Date().toISOString(),
    });
    const before = getWelcomePackageState();

    unlockWelcomePackageGift();

    expect(getWelcomePackageState()).toEqual(before);
  });
});

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
