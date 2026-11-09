import { renderToString } from "react-dom/server";
import { hydrateRoot } from "react-dom/client";
import { act, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { usePathname } from "next/navigation";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ locale: "en", walletAllows: false }));
const mounts = vi.hoisted(() => ({ wallet: vi.fn(), theme: vi.fn(), analytics: vi.fn() }));
vi.mock("next/navigation", () => ({
  usePathname: vi.fn(() => "/"),
  useRouter: () => ({ push: vi.fn() }),
}));
vi.mock("@/components/wallet-provider-boundary", () => ({
  WalletProviderBoundary: ({ children }: { children: import("react").ReactNode }) => {
    mounts.wallet();
    if (state.walletAllows) return <>{children}</>;
    return <div>Wallet access required</div>;
  },
}));
vi.mock("@/components/themes/theme-css-variables", () => ({
  ThemeCssVariables: () => { mounts.theme(); return null; },
}));
vi.mock("@/components/analytics/analytics-boot", () => ({
  AnalyticsBoot: () => { mounts.analytics(); return null; },
}));
vi.mock("next-intl/server", async () => {
  const { default: en } = await import("@/lib/content/messages/en");
  const { default: es } = await import("@/lib/content/messages/es");
  return {
    getTranslations: async (namespace: string) => {
      const resolve = (key: string): unknown => `${namespace}.${key}`.split(".").reduce<unknown>(
        (value, segment) => (value as Record<string, unknown>)[segment],
        state.locale === "es" ? es : en,
      );
      return Object.assign((key: string) => resolve(key) as string, { raw: resolve });
    },
  };
});

import { AppRouteProviders } from "../app-route-providers";
import PrivacyPage from "@/app/[locale]/privacy/page";
import TermsPage from "@/app/[locale]/terms/page";
import SupportPage from "@/app/[locale]/support/page";
import en from "@/lib/content/messages/en";
import es from "@/lib/content/messages/es";

// Also exercise the nullable pathname seen in compatibility/fallback renders.
const pathname = usePathname as import("vitest").Mock<() => string | null>;
const network = vi.fn(() => { throw new Error("QA network disabled"); });

beforeEach(() => {
  vi.clearAllMocks();
  state.locale = "en";
  state.walletAllows = false;
  // No SDKs mount, and even accidental requests cannot leave this QA process.
  vi.stubGlobal("fetch", network);
  vi.stubGlobal("navigator", { userAgent: "QA", language: "en", sendBeacon: network });
  vi.spyOn(XMLHttpRequest.prototype, "open").mockImplementation(network);
});
afterEach(() => {
  expect(network).not.toHaveBeenCalled();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  pathname.mockReturnValue("/");
});

describe("public legal access before wallet loading and login", () => {
  for (const prefix of ["", "/en", "/es"]) {
    for (const [route, page] of [
      ["privacy", PrivacyPage], ["terms", TermsPage], ["support", SupportPage],
    ] as const) {
      it(`renders /${route} with '${prefix}' in SSR and hydration without a wallet or network`, async () => {
        state.locale = prefix === "/es" ? "es" : "en";
        pathname.mockReturnValue(`${prefix}/${route}`);
        const messages = state.locale === "es" ? es : en;
        const content = await page();
        const tree = (
          <NextIntlClientProvider locale={state.locale} messages={messages}>
            <AppRouteProviders>{content}</AppRouteProviders>
          </NextIntlClientProvider>
        );
        const container = document.createElement("div");
        container.innerHTML = renderToString(tree);
        const expected = route === "support"
          ? messages.SUPPORT_COPY.howToReport
          : messages.LEGAL_COPY[route].sections[2].body;
        expect(container.textContent).toContain(expected);
        expect(container.textContent).not.toContain("Wallet access required");
        document.body.appendChild(container);
        const onRecoverableError = vi.fn();
        let root: ReturnType<typeof hydrateRoot>;
        await act(async () => { root = hydrateRoot(container, tree, { onRecoverableError }); });
        expect(container.textContent).toContain(expected);
        expect(onRecoverableError).not.toHaveBeenCalled();
        expect(mounts.wallet).not.toHaveBeenCalled();
        expect(mounts.theme).not.toHaveBeenCalled();
        expect(mounts.analytics).not.toHaveBeenCalled();
        await act(async () => { root.unmount(); });
        container.remove();
      });
    }
  }

  it.each(["/privacy/", "/terms/", "/es/support/"])("allows the exact trailing-slash page %s", (path) => {
    pathname.mockReturnValue(path);
    render(<AppRouteProviders>Public notice</AppRouteProviders>);
    expect(screen.getByText("Public notice")).toBeInTheDocument();
    expect(mounts.wallet).not.toHaveBeenCalled();
  });

  it.each(["/", "/arena", "/es/exercises", "/coach/history", "/privacy-extra", "/terms/private", "/support/admin", "/fr/privacy", null])(
    "retains the wallet gate for %s", (path) => {
      pathname.mockReturnValue(path);
      render(<AppRouteProviders>Protected content</AppRouteProviders>);
      expect(screen.getByText("Wallet access required")).toBeInTheDocument();
      expect(screen.queryByText("Protected content")).not.toBeInTheDocument();
    },
  );

  it("restores the gate when navigating from a legal page to the game", () => {
    pathname.mockReturnValue("/privacy");
    const { rerender } = render(<AppRouteProviders>Route content</AppRouteProviders>);
    expect(screen.getByText("Route content")).toBeInTheDocument();
    pathname.mockReturnValue("/arena");
    rerender(<AppRouteProviders>Route content</AppRouteProviders>);
    expect(screen.queryByText("Route content")).not.toBeInTheDocument();
    expect(screen.getByText("Wallet access required")).toBeInTheDocument();
    pathname.mockReturnValue("/support");
    rerender(<AppRouteProviders>Route content</AppRouteProviders>);
    expect(screen.getByText("Route content")).toBeInTheDocument();
    expect(screen.queryByText("Wallet access required")).not.toBeInTheDocument();
  });

  it("keeps theme and analytics under the wallet boundary on ordinary routes", () => {
    pathname.mockReturnValue("/arena");
    state.walletAllows = true;
    render(<AppRouteProviders>Game content</AppRouteProviders>);
    expect(screen.getByText("Game content")).toBeInTheDocument();
    expect(mounts.wallet).toHaveBeenCalled();
    expect(mounts.theme).toHaveBeenCalledTimes(1);
    expect(mounts.analytics).toHaveBeenCalledTimes(1);
  });
});
