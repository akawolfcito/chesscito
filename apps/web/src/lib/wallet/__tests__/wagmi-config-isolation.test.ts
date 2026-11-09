/**
 * Spec: docs/specs/2026-08-07-wallet-branch-lazy-load.md — next step (1).
 *
 * `wagmiConfig` used to live INSIDE `components/wallet-provider.tsx`. That single
 * import in `lib/claims/sources.ts` is what drags the whole injected branch —
 * component, providers, `ChainConfigWarning` — into every graph that only wanted
 * a wagmi config object. Once the branches are lazy, that import alone is enough
 * to undo the split: webpack keeps the branch in the shared chunk because a
 * non-lazy module still points at it.
 *
 * So the config moves to its own leaf module and importing it from the component
 * must become IMPOSSIBLE BY DESIGN, not merely discouraged (founder, 2026-08-07):
 * no re-export, or the old import path keeps working and nothing changes.
 *
 * ⚠️ This is a SOURCE guard on purpose. A re-export would leave every behavioural
 * test green — the config object is the same object either way. The only
 * observable difference is which modules end up in the bundle, and that is a fact
 * about imports, not about rendering.
 */
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";
import { celo, celoSepolia } from "wagmi/chains";

import { wagmiConfig } from "@/lib/wallet/wagmi-config";

const SRC_DIR = path.resolve(__dirname, "../../..");
const WALLET_PROVIDER = path.join(SRC_DIR, "components/wallet-provider.tsx");

function sourceFiles(directory: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      found.push(...sourceFiles(absolute));
      continue;
    }
    if (/\.tsx?$/.test(entry.name)) {
      found.push(absolute);
    }
  }
  return found;
}

describe("wagmiConfig lives in its own leaf module", () => {
  it("exports the single shared config", () => {
    // celo FIRST: wagmi answers a disconnected visitor with `chains[0]`, and the
    // whole chain-id warning banner is calibrated against that (CLAUDE.md).
    expect(wagmiConfig.chains.map((chain) => chain.id)).toEqual([
      celo.id,
      celoSepolia.id,
    ]);
    expect(wagmiConfig.connectors.map((connector) => connector.id)).toContain(
      "injected"
    );
  });

  it("is not exported from the wallet provider component", () => {
    const source = readFileSync(WALLET_PROVIDER, "utf8");

    // Both spellings: a plain `export const` and the re-export that would
    // silently keep every old import path alive.
    expect(source).not.toMatch(/export\s+const\s+wagmiConfig/);
    expect(source).not.toMatch(/export\s*\{[^}]*wagmiConfig/);
  });

  it("is never imported from @/components/wallet-provider", () => {
    const offenders = sourceFiles(SRC_DIR).filter((file) => {
      const source = readFileSync(file, "utf8");
      return /import\s*\{[^}]*\bwagmiConfig\b[^}]*\}\s*from\s*["']@\/components\/wallet-provider["']/.test(
        source
      );
    });

    expect(offenders.map((file) => path.relative(SRC_DIR, file))).toEqual([]);
  });
});
