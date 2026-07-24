import { describe, expect, it } from "vitest";

import {
  deriveWebAccessState,
  type WebAccessInput,
} from "@/lib/wallet/web-access-state";

// The web branch (WebWalletProvider) must never render productive children
// until Privy confirms an authenticated session AND a ready embedded wallet.
// This pure reducer holds that precedence so the component stays a thin shell
// over a tested state machine (same pattern as resolveWalletBranch).

const base: WebAccessInput = {
  ready: true,
  authenticated: false,
  walletReady: false,
  authenticating: false,
  error: false,
};

describe("deriveWebAccessState", () => {
  it("waits on the environment before anything else", () => {
    expect(deriveWebAccessState({ ...base, ready: false })).toBe(
      "environment-loading",
    );
  });

  it("shows the gate to a hydrated, unauthenticated web user", () => {
    expect(deriveWebAccessState(base)).toBe("unauthenticated");
  });

  it("reports authenticating while a login is in flight", () => {
    expect(
      deriveWebAccessState({ ...base, authenticating: true }),
    ).toBe("authenticating");
  });

  it("prepares the wallet once authenticated but not yet provisioned", () => {
    expect(
      deriveWebAccessState({ ...base, authenticated: true, walletReady: false }),
    ).toBe("wallet-pending");
  });

  it("admits children only when authenticated AND wallet ready", () => {
    expect(
      deriveWebAccessState({ ...base, authenticated: true, walletReady: true }),
    ).toBe("wallet-ready");
  });

  it("surfaces error above every other signal", () => {
    expect(
      deriveWebAccessState({
        ready: false,
        authenticated: true,
        walletReady: true,
        authenticating: true,
        error: true,
      }),
    ).toBe("error");
  });

  it("never admits children (wallet-ready) without a ready wallet", () => {
    for (const authenticated of [true, false]) {
      for (const authenticating of [true, false]) {
        expect(
          deriveWebAccessState({
            ...base,
            authenticated,
            authenticating,
            walletReady: false,
          }),
        ).not.toBe("wallet-ready");
      }
    }
  });

  it("never admits children while unauthenticated, under any input", () => {
    for (const ready of [true, false]) {
      for (const walletReady of [true, false]) {
        expect(
          deriveWebAccessState({
            ...base,
            ready,
            walletReady,
            authenticated: false,
          }),
        ).not.toBe("wallet-ready");
      }
    }
  });
});
