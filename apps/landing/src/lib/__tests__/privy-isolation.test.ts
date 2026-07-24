/**
 * Structural guard: the discovery app (chesscito.com) must never mount Privy.
 *
 * Web access is gated inside `apps/web` (Learn / Play deploys) by
 * `WebAccessGate`; `apps/landing` only discovers and routes to those deploys.
 * The isolation is a compile-time property of the import graph, so this test
 * scans the landing source for any Privy coupling rather than asserting a
 * runtime absence. See docs/specs/2026-07-24-web-access-gate-contract.md §8.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { LEARN_URL, PLAY_URL } from "@/lib/app-urls";

// vitest runs with the package root as cwd (apps/landing).
const SRC_ROOT = join(process.cwd(), "src");
const SELF_BASENAME = "privy-isolation.test.ts";

const FORBIDDEN = [
  "@privy-io/react-auth",
  "@privy-io/wagmi",
  "WebWalletProvider",
  "WebAccessGate",
  "NEXT_PUBLIC_PRIVY",
];

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules") continue;
      out.push(...sourceFiles(full));
    } else if (/\.(ts|tsx)$/.test(entry.name) && entry.name !== SELF_BASENAME) {
      out.push(full);
    }
  }
  return out;
}

describe("landing Privy isolation", () => {
  const files = sourceFiles(SRC_ROOT);

  it("scans a non-trivial number of landing source files", () => {
    expect(files.length).toBeGreaterThan(10);
  });

  for (const token of FORBIDDEN) {
    it(`no landing source references ${token}`, () => {
      const offenders = files.filter((file) =>
        readFileSync(file, "utf8").includes(token),
      );
      expect(offenders).toEqual([]);
    });
  }

  it("routes discovery CTAs to the Learn and Play deploys", () => {
    expect(LEARN_URL).toContain("learn.chesscito.com");
    expect(PLAY_URL).toContain("play.chesscito.com");
  });
});
