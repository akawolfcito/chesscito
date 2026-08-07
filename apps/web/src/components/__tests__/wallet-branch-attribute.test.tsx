/**
 * Spec: docs/specs/2026-08-07-wallet-branch-lazy-load.md — AC25 / C4.
 *
 * Each branch renders `data-wallet-branch` on a node that exists ONLY while that
 * branch is mounted. The attribute does two jobs at once, and that is the design:
 *
 *   1. Behaviour — AC6 ("exactly one provider") is asserted over it, so deleting
 *      it turns these tests red, not just the bundle guard.
 *   2. Bundle — a JSX attribute literal travels into that branch's chunk and
 *      survives minification, so the guard can prove the chunk never reached the
 *      root layout.
 *
 * ⛔ The discarded alternative was an exported `*_BRANCH_MARKER` constant: nobody
 * imports it, Terser drops it, and the guard goes GREEN BY ABSENCE — a test that
 * fails towards green is worse than no test (red team P0, 2026-08-07).
 */
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { WALLET_BRANCH_ATTR } from "@/lib/wallet/wallet-branch";

// Both branches end in the wallet-scoped product contexts, which need far more
// of the app than this assertion does. Their parity has its own suite
// (product-context-parity.test.tsx).
vi.mock("@/components/product-context-providers", () => ({
  ProductContextProviders: ({ children }: { children?: ReactNode }) => children,
}));
// Privy hits the network on mount; the gate has its own suite.
vi.mock("@privy-io/react-auth", () => ({
  PrivyProvider: ({ children }: { children?: ReactNode }) => children,
  useLogout: () => ({ logout: vi.fn() }),
}));
vi.mock("@privy-io/wagmi", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@privy-io/wagmi")>()),
  WagmiProvider: ({ children }: { children?: ReactNode }) => children,
}));
vi.mock("@/components/web-access-gate", () => ({
  WebAccessGate: ({ children }: { children?: ReactNode }) => children,
}));

import { WalletProvider } from "@/components/wallet-provider";
import { WebWalletProvider } from "@/components/web-wallet-provider";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("AC25 — every branch identifies itself in the DOM", () => {
  it('the injected branch renders data-wallet-branch="injected" around its tree', () => {
    render(
      <WalletProvider>
        <span>app tree</span>
      </WalletProvider>
    );

    const marker = document.querySelector(`[${WALLET_BRANCH_ATTR}="injected"]`);
    expect(marker).not.toBeNull();
    // AROUND the tree, not beside it: a detached marker could survive while the
    // branch below it failed to mount, which is precisely what AC6 must catch.
    expect(marker).toContainElement(screen.getByText("app tree"));
    expect(document.querySelectorAll(`[${WALLET_BRANCH_ATTR}]`)).toHaveLength(
      1
    );
  });

  it('the privy branch renders data-wallet-branch="privy" around its tree', () => {
    vi.stubEnv("NEXT_PUBLIC_PRIVY_APP_ID", "app-xyz");

    render(
      <WebWalletProvider>
        <span>app tree</span>
      </WebWalletProvider>
    );

    const marker = document.querySelector(`[${WALLET_BRANCH_ATTR}="privy"]`);
    expect(marker).not.toBeNull();
    expect(marker).toContainElement(screen.getByText("app tree"));
    expect(document.querySelectorAll(`[${WALLET_BRANCH_ATTR}]`)).toHaveLength(
      1
    );
  });
});
