/**
 * Spec: docs/specs/2026-08-07-wallet-branch-lazy-load.md
 *
 * The two highest-risk behaviours of the lazy composition, written FIRST
 * (founder, 2026-08-07): a Suspense + error-boundary tree that looks correct can
 * hide a real regression in exactly these two places.
 *
 *   AC7  — `children` mounts EXACTLY ONCE across `undecided → shell → branch`.
 *          Counting is the only way to see this: the DOM after the transition
 *          looks identical whether children mounted once or three times.
 *   AC21 — a provider that THROWS during render lands in the terminal state,
 *          not in an eternal shell. This is a RENDER error, not a load error,
 *          which is why the boundary has to be a class component.
 */
import { screen } from "@testing-library/react";

import { renderWithIntl as render } from "@/test-utils/render-with-intl";
import { useEffect, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { WALLET_BRANCH_ATTR } from "@/lib/wallet/wallet-branch";

/** Counts MOUNTS, never decremented on unmount: a remount must be visible as a
 *  second count, which a symmetric counter would hide. */
let childMounts = 0;

function InstrumentedChild() {
  useEffect(() => {
    childMounts += 1;
  }, []);
  return <span data-testid="app-tree">app tree</span>;
}

/** Set per test, so one test can make the branch explode during render. */
let injectedShouldThrow = false;

vi.mock("@/components/wallet-provider", () => ({
  WalletProvider: ({ children }: { children?: ReactNode }) => {
    if (injectedShouldThrow) {
      throw new Error("branch exploded during render");
    }
    return <div data-wallet-branch="injected">{children}</div>;
  },
}));

vi.mock("@/components/web-wallet-provider", () => ({
  WebWalletProvider: ({ children }: { children?: ReactNode }) => (
    <div data-wallet-branch="privy">{children}</div>
  ),
}));

vi.mock("@/lib/minipay", () => ({ isMiniPayEnv: vi.fn(() => true) }));

import { WalletProviderBoundary } from "@/components/wallet-provider-boundary";

beforeEach(() => {
  childMounts = 0;
  injectedShouldThrow = false;
  vi.stubEnv("NEXT_PUBLIC_PRIVY_ENABLED", "true");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("lazy wallet branch — AC7: children mount exactly once", () => {
  it("mounts the app tree once across undecided → shell → branch", async () => {
    render(
      <WalletProviderBoundary>
        <InstrumentedChild />
      </WalletProviderBoundary>,
    );

    // The branch arrives asynchronously now: it is behind an import().
    await screen.findByTestId("app-tree");

    expect(
      document.querySelector(`[${WALLET_BRANCH_ATTR}="injected"]`),
    ).not.toBeNull();
    // The whole point. A Suspense fallback that swaps in the wrong position, or
    // a boundary that remounts on resolve, shows up here as 2 or 3.
    expect(childMounts).toBe(1);
  });
});

describe("lazy wallet branch — AC21: a throwing branch is terminal, not eternal", () => {
  it("shows the retry affordance instead of hanging on the shell", async () => {
    injectedShouldThrow = true;

    render(
      <WalletProviderBoundary>
        <InstrumentedChild />
      </WalletProviderBoundary>,
    );

    // A render throw must be CAUGHT and turned into a visible terminal state.
    // Without a class boundary this either crashes the tree or leaves the shell
    // on screen forever — the two failures E3 exists to prevent.
    expect(
      await screen.findByRole("button", { name: /retry|reintentar/i }),
    ).toBeInTheDocument();

    // And the shell must be GONE: "still loading" next to an error is the
    // ambiguous state the three-owner composition is meant to remove.
    expect(screen.queryByTestId("wallet-shell")).toBeNull();
  });
});
