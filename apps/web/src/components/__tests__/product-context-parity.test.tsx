import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render as rtlRender, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const privyState = vi.hoisted(() => ({ ready: true, authenticated: true, address: "0xabc" }));

vi.mock("@privy-io/react-auth", () => ({
  PrivyProvider: ({ children }: { children?: ReactNode }) => children,
  useLogout: () => ({ logout: vi.fn() }),
  usePrivy: () => ({ ready: privyState.ready, authenticated: privyState.authenticated }),
  useLogin: () => ({ login: vi.fn() }),
}));
vi.mock("wagmi", async (importOriginal) => ({
  ...(await importOriginal<typeof import("wagmi")>()),
  useAccount: () => ({ address: privyState.address }),
  useDisconnect: () => ({ disconnect: vi.fn() }),
}));
// The two providers' own behavior is covered by their own suites and is
// explicitly out of scope here (no logic changes allowed). What parity means is
// that BOTH branches mount the same wrapper, so the season-pass fetch is stubbed
// to keep this suite structural and offline.
vi.mock("@/lib/season-pass/use-season-pass-status", () => ({
  EffectiveTrainingPassProvider: ({ children }: { children?: ReactNode }) => (
    <div data-provider="training-pass">{children}</div>
  ),
  // The theme tier reads the pass through this hook; an inactive snapshot keeps
  // the tier deterministic without touching the network.
  useSeasonPassStatus: () => ({
    state: "inactive" as const,
    active: false,
    source: null,
    seasonPassExpiresAt: null,
    proExpiresAt: null,
    loading: false,
    error: null,
    seasonId: null,
    supporterStatus: null,
    shieldsCredited: 0,
    walletKey: null,
    refresh: vi.fn(),
  }),
}));

import { ProductContextProviders } from "@/components/product-context-providers";
import { WebAccessGate } from "@/components/web-access-gate";
import { useThemeVariant } from "@/lib/themes/theme-variant-provider";

function source(path: string): string {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

const walletProvider = source("src/components/wallet-provider.tsx");
const webWalletProvider = source("src/components/web-wallet-provider.tsx");
const productContexts = source("src/components/product-context-providers.tsx");

/** Reads the theme context, which only resolves under ThemeVariantProvider. */
function ThemeProbe() {
  return <span data-testid="theme-tier">{useThemeVariant()}</span>;
}

/** Both branches put a QueryClientProvider above these contexts (the theme tier
 *  reads PRO status through react-query), so the test tree does the same. */
function render(ui: ReactNode) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return rtlRender(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

beforeEach(() => {
  privyState.ready = true;
  privyState.authenticated = true;
  privyState.address = "0xabc";
});

describe("ProductContextProviders", () => {
  it("provides the training pass and theme contexts to its children", () => {
    render(
      <ProductContextProviders>
        <ThemeProbe />
      </ProductContextProviders>,
    );

    expect(document.querySelector('[data-provider="training-pass"]')).not.toBeNull();
    expect(screen.getByTestId("theme-tier")).toBeInTheDocument();
  });

  it("holds exactly one instance of each provider, training pass outermost", () => {
    // The theme tier is derived from the training pass, so the order is load
    // bearing, not stylistic.
    expect(productContexts.match(/<EffectiveTrainingPassProvider\b/g)).toHaveLength(1);
    expect(productContexts.match(/<ThemeVariantProvider\b/g)).toHaveLength(1);
    expect(productContexts.indexOf("<EffectiveTrainingPassProvider")).toBeLessThan(
      productContexts.indexOf("<ThemeVariantProvider"),
    );
  });

  it("touches no payment or entitlement logic", () => {
    expect(productContexts).not.toMatch(/payment/i);
    expect(productContexts).not.toMatch(/@\/lib\/(peones|shop)/);
    expect(productContexts).not.toMatch(/verify-pro|verify-payment/);
  });
});

describe("branch parity", () => {
  it("mounts the wrapper once on the injected branch", () => {
    expect(walletProvider.match(/<ProductContextProviders\b/g)).toHaveLength(1);
    // Extracted, not duplicated — a second copy here would double the tree.
    expect(walletProvider).not.toMatch(/<EffectiveTrainingPassProvider\b/);
    expect(walletProvider).not.toMatch(/<ThemeVariantProvider\b/);
  });

  it("mounts the same wrapper once on the Privy branch", () => {
    expect(webWalletProvider.match(/<ProductContextProviders\b/g)).toHaveLength(1);
    expect(webWalletProvider).not.toMatch(/<EffectiveTrainingPassProvider\b/);
    expect(webWalletProvider).not.toMatch(/<ThemeVariantProvider\b/);
  });

  it("puts the Privy wrapper INSIDE the access gate, not around it", () => {
    // Product contexts are wallet-scoped: mounting them outside the gate would
    // run them for a user with no session and no address.
    expect(webWalletProvider.indexOf("<WebAccessGate")).toBeLessThan(
      webWalletProvider.indexOf("<ProductContextProviders"),
    );
  });

  it("keeps the injected branch free of Privy", () => {
    expect(walletProvider).not.toMatch(/@privy-io/);
    expect(walletProvider).not.toMatch(/web-wallet-provider/);
  });
});

describe("unauthenticated web", () => {
  it("mounts no product context until the session and wallet are ready", () => {
    privyState.authenticated = false;
    privyState.address = "";
    render(
      <WebAccessGate>
        <ProductContextProviders>
          <ThemeProbe />
        </ProductContextProviders>
      </WebAccessGate>,
    );

    expect(document.querySelector('[data-provider="training-pass"]')).toBeNull();
    expect(screen.queryByTestId("theme-tier")).not.toBeInTheDocument();
  });

  it("mounts them once the wallet is ready", () => {
    render(
      <WebAccessGate>
        <ProductContextProviders>
          <ThemeProbe />
        </ProductContextProviders>
      </WebAccessGate>,
    );

    expect(document.querySelector('[data-provider="training-pass"]')).not.toBeNull();
    expect(screen.getByTestId("theme-tier")).toBeInTheDocument();
  });
});
