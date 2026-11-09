import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Regression guard for the 2026-07-24 smoke failure: `@privy-io/react-auth`
// reaches for Node's `Buffer` global on the embedded-wallet crypto path, and
// Vite (unlike webpack/CRA) does not polyfill Node globals in the browser — it
// externalizes `buffer` to a stub that throws. Result: signing AND sending both
// died with `ReferenceError: Buffer is not defined`, while every Celo-specific
// step (chain switch, fee estimate) worked fine.
// See docs/validations/2026-07-24-privy-harness-smoke-diagnosis.md

const SRC_DIR = dirname(fileURLToPath(import.meta.url)).replace(/\/__tests__$/, "");

/** Import specifiers in source order, covering side-effect imports too. */
function importOrder(source: string): string[] {
  return [...source.matchAll(/import\s+(?:[^"';]*?\s+from\s+)?["']([^"']+)["']/g)].map(
    (m) => m[1],
  );
}

describe("browser globals polyfill", () => {
  const realBuffer = globalThis.Buffer;

  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    globalThis.Buffer = realBuffer;
  });

  it("defines globalThis.Buffer when the browser lacks it", async () => {
    // Simulate the browser realm, where Buffer simply does not exist.
    delete (globalThis as { Buffer?: unknown }).Buffer;
    expect(globalThis.Buffer).toBeUndefined();

    await import("../polyfills");

    expect(typeof globalThis.Buffer).toBe("function");
    expect(typeof globalThis.Buffer.from).toBe("function");
    // The shape Privy actually calls.
    expect(globalThis.Buffer.from("chesscito", "utf8").toString("hex")).toBe(
      "63686573736369746f",
    );
  });

  it("does not clobber a Buffer the runtime already provides", async () => {
    expect(globalThis.Buffer).toBe(realBuffer);

    await import("../polyfills");

    expect(globalThis.Buffer).toBe(realBuffer);
  });

  it("main entry imports the polyfill before any Privy/wagmi module", () => {
    const specs = importOrder(readFileSync(join(SRC_DIR, "main.tsx"), "utf8"));

    const polyfillAt = specs.findIndex((s) => /(^|\/)polyfills$/.test(s));
    expect(polyfillAt, "main.tsx must import ./polyfills").toBeGreaterThanOrEqual(0);

    // ./providers is what pulls in @privy-io/react-auth and wagmi.
    const privyAt = specs.findIndex((s) => /privy|wagmi|providers/.test(s));
    expect(privyAt, "main.tsx must import the Privy provider tree").toBeGreaterThanOrEqual(
      0,
    );

    expect(
      polyfillAt,
      "the polyfill must be evaluated before Privy/wagmi are loaded",
    ).toBeLessThan(privyAt);
  });
});
