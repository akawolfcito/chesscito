import { describe, expect, it } from "vitest";

import { isMilestoneSeedReady } from "../use-milestone-seeding";

/**
 * The seeding gate — the single thing standing between a veteran player and a
 * retroactive parade of overlays for history they lived months ago.
 *
 * The gate shipped bare in the previous fix: the expression lived inline in two
 * components, so nothing could go red if one of them drifted. It is a pure
 * function now, used by BOTH `exercises-screen.tsx` and `learn-hub-client.tsx`.
 */
describe("isMilestoneSeedReady", () => {
  it("waits while wagmi is connecting — the badge read is DISABLED, not empty", () => {
    // The trap the old `!isBadgesLoading` gate fell into: a disabled TanStack
    // query reports `isLoading === false`, so "not loading" read as "answered".
    // `badgeStateKnown: false` is the honest signal, and it must dominate.
    expect(
      isMilestoneSeedReady({ accountStatus: "connecting", badgeStateKnown: false }),
    ).toBe(false);
    // Even a stale answer from a previous session must not unblock a connect
    // that has not landed: the address it was read for may not be this one.
    expect(
      isMilestoneSeedReady({ accountStatus: "connecting", badgeStateKnown: true }),
    ).toBe(false);
  });

  it("waits while wagmi is reconnecting — the mainline MiniPay boot state", () => {
    expect(
      isMilestoneSeedReady({ accountStatus: "reconnecting", badgeStateKnown: false }),
    ).toBe(false);
    expect(
      isMilestoneSeedReady({ accountStatus: "reconnecting", badgeStateKnown: true }),
    ).toBe(false);
  });

  it("seeds a DISCONNECTED, wallet-less player — no wallet means no badges", () => {
    // `resolve()` would read exactly the same `badgeClaimed: false`. Refusing to
    // seed here would strand every wallet-less player unmigrated forever.
    expect(
      isMilestoneSeedReady({ accountStatus: "disconnected", badgeStateKnown: false }),
    ).toBe(true);
  });

  it("seeds a connected player only once the badge read has ANSWERED", () => {
    expect(
      isMilestoneSeedReady({ accountStatus: "connected", badgeStateKnown: false }),
    ).toBe(false);
    expect(
      isMilestoneSeedReady({ accountStatus: "connected", badgeStateKnown: true }),
    ).toBe(true);
  });

  it("never seeds on an unsupported chain, where the badge state is unknowable", () => {
    // `getBadgesAddress()` returns null off the configured chain, so the read
    // stays disabled and `badgeStateKnown` is false FOREVER. Treating that as
    // "no badges" would stamp the profile migrated with `piece-badge-claimed`
    // and `mastery` unseeded — and the veteran's real badges would fire as
    // fresh overlays the moment they switched back.
    expect(
      isMilestoneSeedReady({ accountStatus: "connected", badgeStateKnown: false }),
    ).toBe(false);
  });

  it("is not ready before wagmi reports any status at all", () => {
    expect(
      isMilestoneSeedReady({ accountStatus: undefined, badgeStateKnown: true }),
    ).toBe(false);
  });
});
