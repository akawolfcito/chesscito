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
import userEvent from "@testing-library/user-event";
import { renderToStaticMarkup } from "react-dom/server";

import { renderWithIntl as render } from "@/test-utils/render-with-intl";
import { useEffect, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { walletBranchLoaders } from "@/components/wallet-branch-loaders";
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
import { isMiniPayEnv } from "@/lib/minipay";

const minipayMock = vi.mocked(isMiniPayEnv);

beforeEach(() => {
  childMounts = 0;
  injectedShouldThrow = false;
  minipayMock.mockReturnValue(true);
  vi.stubEnv("NEXT_PUBLIC_PRIVY_ENABLED", "true");
});

afterEach(() => {
  vi.unstubAllEnvs();
  // The loader spies wrap a module-level object shared by every test here.
  vi.restoreAllMocks();
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
    expect(document.querySelector("[data-wallet-shell]")).toBeNull();
  });
});

describe("lazy wallet branch — AC2/AC3: nothing loads on the server", () => {
  // renderToStaticMarkup runs no effects, so the component stays UNHYDRATED —
  // exactly the SSR and first-client-render state.
  function ssr(node: ReactNode) {
    return renderToStaticMarkup(<>{node}</>);
  }

  it("emits the shell and fires no loader before hydration", () => {
    const injected = vi.spyOn(walletBranchLoaders, "injected");
    const privy = vi.spyOn(walletBranchLoaders, "privy");

    const html = ssr(
      <WalletProviderBoundary>
        <InstrumentedChild />
      </WalletProviderBoundary>,
    );

    expect(html).toMatch(/data-wallet-shell/);
    expect(html).not.toMatch(new RegExp(WALLET_BRANCH_ATTR));
    // The whole point of the split: a request that never reaches a browser must
    // not pull a wallet chunk into the payload.
    expect(injected).not.toHaveBeenCalled();
    expect(privy).not.toHaveBeenCalled();
  });

  it("emits the shell with the flag OFF too — the branch is a client fact", () => {
    // ⚠️ DELIBERATE CHANGE (spec AC2, E1). This used to assert the opposite:
    // with the flag off the server rendered the injected provider outright. Once
    // the branch is lazy that is no longer possible, and pretending otherwise
    // would mean shipping the branch in the server payload again.
    vi.stubEnv("NEXT_PUBLIC_PRIVY_ENABLED", "false");

    const html = ssr(
      <WalletProviderBoundary>
        <InstrumentedChild />
      </WalletProviderBoundary>,
    );

    expect(html).toMatch(/data-wallet-shell/);
    expect(html).not.toContain("app tree");
  });
});

describe("lazy wallet branch — AC4/AC5: the other branch is never requested", () => {
  it("inside MiniPay, the Privy chunk is never asked for", async () => {
    const privy = vi.spyOn(walletBranchLoaders, "privy");
    minipayMock.mockReturnValue(true);

    render(
      <WalletProviderBoundary>
        <InstrumentedChild />
      </WalletProviderBoundary>,
    );

    await screen.findByTestId("app-tree");
    // This is the saving, stated as an assertion: a MiniPay player must not pay
    // for a single byte of the branch they will never run.
    expect(privy).not.toHaveBeenCalled();
  });

  it("on the web, the injected chunk is never asked for", async () => {
    const injected = vi.spyOn(walletBranchLoaders, "injected");
    minipayMock.mockReturnValue(false);

    render(
      <WalletProviderBoundary>
        <InstrumentedChild />
      </WalletProviderBoundary>,
    );

    await screen.findByTestId("app-tree");
    expect(injected).not.toHaveBeenCalled();
  });
});

describe("lazy wallet branch — AC23: retry produces a NEW attempt", () => {
  it("invokes the loader a second time, not just re-renders the error", async () => {
    // A `Retry` that hands back the same rejected promise without touching the
    // network is a LIE (spec C2c). The only honest assertion is a second
    // invocation, so that is what this counts.
    const injected = vi.spyOn(walletBranchLoaders, "injected");
    injectedShouldThrow = true;

    render(
      <WalletProviderBoundary>
        <InstrumentedChild />
      </WalletProviderBoundary>,
    );

    const retry = await screen.findByRole("button", { name: /retry|reintentar/i });
    expect(injected).toHaveBeenCalledTimes(1);

    await userEvent.click(retry);

    expect(injected).toHaveBeenCalledTimes(2);
  });
});

describe("lazy wallet branch — AC20: the retry RECOVERS, and more than once", () => {
  it("mounts the branch when a later attempt succeeds", async () => {
    // AC23 proves a new attempt happens. AC20 is a different claim and needs its
    // own test: that the attempt which SUCCEEDS actually lands the player in the
    // app. A retry that faithfully re-requests a chunk and then fails to mount it
    // is still a dead end for the player.
    const injected = vi.spyOn(walletBranchLoaders, "injected");
    injectedShouldThrow = true;

    render(
      <WalletProviderBoundary>
        <InstrumentedChild />
      </WalletProviderBoundary>,
    );

    // First failure.
    await userEvent.click(
      await screen.findByRole("button", { name: /retry|reintentar/i }),
    );
    // Still broken — the retry must survive being used AGAIN, which a
    // one-shot recovery flag would not.
    await userEvent.click(
      await screen.findByRole("button", { name: /retry|reintentar/i }),
    );
    expect(injected).toHaveBeenCalledTimes(3);

    // Now the branch works — the network came back, the deploy settled.
    injectedShouldThrow = false;
    await userEvent.click(
      await screen.findByRole("button", { name: /retry|reintentar/i }),
    );

    await screen.findByTestId("app-tree");
    expect(
      document.querySelector(`[${WALLET_BRANCH_ATTR}="injected"]`),
    ).not.toBeNull();
    // And no error state left behind next to a working app.
    expect(
      screen.queryByRole("button", { name: /retry|reintentar/i }),
    ).toBeNull();
    // The app tree mounted exactly once even across three failed attempts:
    // recovery must not leave a second copy of the app behind.
    expect(childMounts).toBe(1);
  });
});
