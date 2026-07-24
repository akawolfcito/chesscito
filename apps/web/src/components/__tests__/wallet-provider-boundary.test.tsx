import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

// Both providers are stubbed to identifiable markers so a test can assert which
// one mounted, and that exactly one does. isMiniPayEnv is mocked so the branch
// input is controlled per test.
vi.mock("@/components/wallet-provider", () => ({
  WalletProvider: ({ children }: { children?: ReactNode }) => (
    <div data-provider="injected">{children}</div>
  ),
}));
vi.mock("@/components/web-wallet-provider", () => ({
  WebWalletProvider: ({ children }: { children?: ReactNode }) => (
    <div data-provider="privy">{children}</div>
  ),
}));
vi.mock("@/lib/minipay", () => ({
  isMiniPayEnv: vi.fn(() => false),
}));

import { WebWalletProvider } from "@/components/web-wallet-provider";
import { WalletProvider } from "@/components/wallet-provider";
import { WalletProviderBoundary } from "@/components/wallet-provider-boundary";
import { isMiniPayEnv } from "@/lib/minipay";

const minipayMock = vi.mocked(isMiniPayEnv);

const child = <span>app tree</span>;

// renderToStaticMarkup runs no effects → the component stays unhydrated, which
// is exactly the SSR / first-client-render state.
function ssr(node: ReactNode) {
  return renderToStaticMarkup(<>{node}</>);
}

afterEach(() => {
  vi.unstubAllEnvs();
  minipayMock.mockReturnValue(false);
});

describe("WalletProviderBoundary — flag OFF", () => {
  it("mounts WalletProvider", () => {
    vi.stubEnv("NEXT_PUBLIC_PRIVY_ENABLED", "false");
    render(<WalletProviderBoundary>{child}</WalletProviderBoundary>);
    expect(screen.getByText("app tree")).toBeInTheDocument();
    expect(document.querySelector('[data-provider="injected"]')).not.toBeNull();
  });

  it("shows no undecided shell, even before hydration", () => {
    vi.stubEnv("NEXT_PUBLIC_PRIVY_ENABLED", "false");
    const html = ssr(<WalletProviderBoundary>{child}</WalletProviderBoundary>);
    expect(html).not.toMatch(/data-wallet-shell/);
    expect(html).toContain("app tree");
  });
});

describe("WalletProviderBoundary — flag ON", () => {
  it("renders the undecided shell before hydration", () => {
    vi.stubEnv("NEXT_PUBLIC_PRIVY_ENABLED", "true");
    const html = ssr(<WalletProviderBoundary>{child}</WalletProviderBoundary>);
    expect(html).toMatch(/data-wallet-shell/);
  });

  it("mounts WalletProvider inside MiniPay once hydrated", () => {
    vi.stubEnv("NEXT_PUBLIC_PRIVY_ENABLED", "true");
    minipayMock.mockReturnValue(true);
    render(<WalletProviderBoundary>{child}</WalletProviderBoundary>);
    expect(document.querySelector('[data-provider="injected"]')).not.toBeNull();
    expect(document.querySelector('[data-provider="privy"]')).toBeNull();
  });

  it("mounts WebWalletProvider on the web once hydrated", () => {
    vi.stubEnv("NEXT_PUBLIC_PRIVY_ENABLED", "true");
    minipayMock.mockReturnValue(false);
    render(<WalletProviderBoundary>{child}</WalletProviderBoundary>);
    expect(document.querySelector('[data-provider="privy"]')).not.toBeNull();
    expect(document.querySelector('[data-provider="injected"]')).toBeNull();
  });
});

describe("WalletProviderBoundary — invariants", () => {
  it("never mounts both providers", () => {
    for (const flag of ["true", "false"]) {
      for (const miniPay of [true, false]) {
        vi.stubEnv("NEXT_PUBLIC_PRIVY_ENABLED", flag);
        minipayMock.mockReturnValue(miniPay);
        const { unmount } = render(
          <WalletProviderBoundary>{child}</WalletProviderBoundary>,
        );
        expect(document.querySelectorAll("[data-provider]")).toHaveLength(1);
        unmount();
      }
    }
  });

  it("never reaches the Privy provider from inside MiniPay", () => {
    for (const flag of ["true", "false"]) {
      vi.stubEnv("NEXT_PUBLIC_PRIVY_ENABLED", flag);
      minipayMock.mockReturnValue(true);
      const { unmount } = render(
        <WalletProviderBoundary>{child}</WalletProviderBoundary>,
      );
      expect(document.querySelector('[data-provider="privy"]')).toBeNull();
      unmount();
    }
  });

  it("keeps the undecided shell free of children and wagmi hooks", () => {
    vi.stubEnv("NEXT_PUBLIC_PRIVY_ENABLED", "true");
    const html = ssr(<WalletProviderBoundary>{child}</WalletProviderBoundary>);
    expect(html).not.toContain("app tree");
    expect(html).not.toMatch(/data-provider/);
  });

  it("keeps the two providers importable but distinct", () => {
    // Guards the mocks stay wired to the real module paths.
    expect(WalletProvider).toBeTypeOf("function");
    expect(WebWalletProvider).toBeTypeOf("function");
  });
});

describe("wiring", () => {
  const layoutSource = readFileSync(
    resolve(process.cwd(), "src/app/[locale]/layout.tsx"),
    "utf8",
  );
  const envTemplate = readFileSync(resolve(process.cwd(), ".env.template"), "utf8");

  it("does not let the Server Component layout branch on isMiniPayEnv", () => {
    expect(layoutSource).not.toMatch(/isMiniPay/);
  });

  it("mounts the boundary from the layout instead of WalletProvider directly", () => {
    expect(layoutSource).toMatch(/WalletProviderBoundary/);
  });

  it("documents NEXT_PUBLIC_PRIVY_ENABLED in the env template", () => {
    expect(envTemplate).toMatch(/^NEXT_PUBLIC_PRIVY_ENABLED=false$/m);
  });
});
