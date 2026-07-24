import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { celo } from "wagmi/chains";

// PrivyProvider hits Privy's network on mount, so it is stubbed to a
// passthrough — which also demonstrates the guest guarantee: children render
// without any login. `createConfig` from @privy-io/wagmi is kept real so the
// wagmi-config assertions exercise the true wiring; only WagmiProvider (which
// reads Privy context) is stubbed for the render test.
vi.mock("@privy-io/react-auth", () => ({
  PrivyProvider: ({ children }: { children?: ReactNode }) => children,
}));
vi.mock("@privy-io/wagmi", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@privy-io/wagmi")>()),
  WagmiProvider: ({ children }: { children?: ReactNode }) => children,
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
  it("renders children for a guest — no login required", () => {
    vi.stubEnv("NEXT_PUBLIC_PRIVY_APP_ID", "app-xyz");
    render(
      <WebWalletProvider>
        <div>guest content</div>
      </WebWalletProvider>,
    );
    expect(screen.getByText("guest content")).toBeInTheDocument();
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
