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

    expect(walletProvider.match(/<QueryClientProvider\b/g)).toHaveLength(1);
    expect(walletProvider.match(/<ThemeVariantProvider\b/g)).toHaveLength(1);
    expect(localeLayout.match(/<WalletProvider\b/g)).toHaveLength(1);
  });

  it("does not shadow the effective tier inside either Hub", () => {
    const learn = source("src/components/hub/hub-lite-scaffold.tsx");
    const play = source("src/components/hub/play-hub-scaffold.tsx");

    expect(learn).not.toContain("ThemeVariantOverride");
    expect(play).not.toContain("ThemeVariantOverride");
  });
});
