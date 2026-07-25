import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function source(path: string): string {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("runtime entitlement provider tree", () => {
  it("mounts one QueryClient and one theme provider for the locale app", () => {
    const walletProvider = source("src/components/wallet-provider.tsx");
    const localeLayout = source("src/app/[locale]/layout.tsx");
    // The two entitlement/theme providers moved into ProductContextProviders so
    // the Privy branch mounts the same pair (provider parity, 2026-07-25). The
    // invariant is unchanged — one instance, training pass outermost — it just
    // lives one file over now.
    const productContexts = source("src/components/product-context-providers.tsx");

    expect(walletProvider.match(/<QueryClientProvider\b/g)).toHaveLength(1);
    expect(walletProvider.match(/<ProductContextProviders\b/g)).toHaveLength(1);
    expect(productContexts.match(/<EffectiveTrainingPassProvider\b/g)).toHaveLength(1);
    expect(productContexts.match(/<ThemeVariantProvider\b/g)).toHaveLength(1);
    expect(productContexts.indexOf("<EffectiveTrainingPassProvider")).toBeLessThan(
      productContexts.indexOf("<ThemeVariantProvider"),
    );
    expect(productContexts.indexOf("</ThemeVariantProvider>")).toBeLessThan(
      productContexts.indexOf("</EffectiveTrainingPassProvider>"),
    );
    // The layout mounts the client boundary, which mounts exactly one
    // WalletProvider (unchanged) — the single QueryClient/theme tree above.
    expect(localeLayout.match(/<WalletProviderBoundary\b/g)).toHaveLength(1);
    expect(localeLayout).not.toMatch(/<WalletProvider>/);
  });

  it("does not shadow the effective tier inside either Hub", () => {
    const learn = source("src/components/hub/hub-lite-scaffold.tsx");
    const play = source("src/components/hub/play-hub-scaffold.tsx");

    expect(learn).not.toContain("ThemeVariantOverride");
    expect(play).not.toContain("ThemeVariantOverride");
  });

  it("shows registry surface classification in the Theme Builder", () => {
    const builder = source("src/app/dev/theme-builder/page.tsx");
    expect(builder).toContain("slot.surface");
    expect(builder).toContain("theme-slot-surface-");
  });
});
