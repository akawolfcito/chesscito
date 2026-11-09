import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { celo } from "wagmi/chains";

// PrivyProvider hits Privy's network on mount, so it is stubbed to a
// passthrough. `createConfig` from @privy-io/wagmi is kept real so the
// wagmi-config assertions exercise the true wiring; only WagmiProvider (which
// reads Privy context) is stubbed for the render test. WebAccessGate is stubbed
// to a passthrough too — the gate has its own suite (web-access-gate.test.tsx);
// here we only assert that WebWalletProvider mounts the stack and wraps its
// children in the gate.
vi.mock("@privy-io/react-auth", () => ({
  PrivyProvider: ({ children }: { children?: ReactNode }) => children,
  // `PrivyWalletSession` sits in the tree and reads this; its own behavior is
  // covered in web-wallet-session.test.tsx.
  useLogout: () => ({ logout: vi.fn() }),
}));
vi.mock("@privy-io/wagmi", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@privy-io/wagmi")>()),
  WagmiProvider: ({ children }: { children?: ReactNode }) => children,
}));
vi.mock("@/components/web-access-gate", () => ({
  WebAccessGate: ({ children }: { children?: ReactNode }) => children,
}));
// Wallet-scoped and covered by product-context-parity.test.tsx; with
// WagmiProvider stubbed above it would have no config to read.
vi.mock("@/components/product-context-providers", () => ({
  ProductContextProviders: ({ children }: { children?: ReactNode }) => children,
}));

import {
  WebWalletProvider,
  createWebWagmiConfig,
  requirePrivyAppId,
} from "@/components/web-wallet-provider";

const moduleSource = readFileSync(
  resolve(process.cwd(), "src/components/web-wallet-provider.tsx"),
  "utf8",
);
const walletProviderSource = readFileSync(
  resolve(process.cwd(), "src/components/wallet-provider.tsx"),
  "utf8",
);

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("createWebWagmiConfig", () => {
  it("configures Celo mainnet only — no Sepolia", () => {
    expect(createWebWagmiConfig().chains.map((chain) => chain.id)).toEqual([celo.id]);
  });

  it("registers no injected connector — the web branch is Privy-only", () => {
    expect(
      createWebWagmiConfig().connectors.some((connector) => connector.id === "injected"),
    ).toBe(false);
  });

  it("wires the shared fallback transport for celo mainnet", () => {
    const client = createWebWagmiConfig().getClient({ chainId: celo.id });
    expect(client.transport.type).toBe("fallback");
  });
});

describe("requirePrivyAppId", () => {
  it("throws when NEXT_PUBLIC_PRIVY_APP_ID is missing — required only at mount", () => {
    vi.stubEnv("NEXT_PUBLIC_PRIVY_APP_ID", "");
    expect(() => requirePrivyAppId()).toThrow();
  });

  it("returns the app id when set", () => {
    vi.stubEnv("NEXT_PUBLIC_PRIVY_APP_ID", "app-xyz");
    expect(requirePrivyAppId()).toBe("app-xyz");
  });
});

describe("WebWalletProvider", () => {
  it("mounts the provider stack and wraps children in the access gate", () => {
    vi.stubEnv("NEXT_PUBLIC_PRIVY_APP_ID", "app-xyz");
    render(
      <WebWalletProvider>
        <div>gated content</div>
      </WebWalletProvider>,
    );
    // The gate is stubbed to a passthrough here, so children reach the DOM;
    // its real gating behavior is covered in web-access-gate.test.tsx.
    expect(screen.getByText("gated content")).toBeInTheDocument();
  });

  it("wraps children in WebAccessGate — no guest bypass in the source", () => {
    expect(moduleSource).toMatch(/WebAccessGate/);
  });
});

describe("Privy modal appearance", () => {
  // The login modal is the one screen where an /art literal is tempting: it is
  // configured in JS, not CSS, so the theme resolver is not the obvious path.
  // Hardcoding it turns `brand.title` mixed and the theme builder's Replace
  // stops reaching the modal — caught by runtime-coverage.test.ts, asserted
  // here so the reason survives next to the code.
  it("resolves the wordmark through a slot, never an /art literal", () => {
    expect(moduleSource).toMatch(/useCurrentThemeAsset\("brand\.title-login"\)/);
    expect(moduleSource).not.toMatch(/["'`]\/art\//);
  });

  // The whole point of carving the slot: a Replace on the login wordmark must
  // not move the hub's, and vice versa.
  it("keeps the modal wordmark off the slot the hub scaffolds render", () => {
    expect(moduleSource).not.toMatch(/useCurrentThemeAsset\("brand\.title"\)/);
  });
});

describe("branch isolation", () => {
  it("never imports MiniPay wallet code", () => {
    expect(moduleSource).not.toMatch(/@\/lib\/minipay/);
    expect(moduleSource).not.toMatch(/@\/components\/wallet-provider/);
  });

  it("never reads PRIVY_APP_SECRET from the environment", () => {
    expect(moduleSource).not.toMatch(/process\.env\S*APP_SECRET/);
  });

  it("leaves the existing MiniPay WalletProvider untouched", () => {
    expect(walletProviderSource).not.toMatch(/web-wallet-provider/);
    expect(walletProviderSource).not.toMatch(/@privy-io/);
  });
});
