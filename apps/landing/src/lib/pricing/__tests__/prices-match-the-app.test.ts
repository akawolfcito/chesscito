/**
 * The published prices must equal what the app actually charges.
 *
 * ⛔ WHY THIS EXISTS. The landing cannot import from `apps/web` — its `@/*`
 * resolves to its own `src` — so the numbers on the public pricing page are a
 * COPY. A copy of a price is how a company ends up advertising a number it
 * stopped charging, in public, on a page a business directory links to.
 *
 * So the copy is checked against the source: this reads
 * `apps/web/src/lib/payments/rail-config.ts` off disk and compares the literals.
 * If someone changes a price in the app, this goes red instead of the website
 * quietly lying.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import {
  PEONES_MAX_AMOUNT,
  PEONES_MIN_AMOUNT,
  PEONES_UNIT_PRICE_USD6,
  PLANS,
  PRO_DURATION_DAYS,
  PRO_PRICE_USD6,
  formatUsd6,
} from "../plans";

const railConfig = readFileSync(
  path.resolve(
    process.cwd(),
    "..",
    "web",
    "src",
    "lib",
    "payments",
    "rail-config.ts",
  ),
  "utf8",
);

/** Reads `export const NAME = 123_456n;` out of the app's config. */
function bigintConst(name: string): bigint {
  const hit = railConfig.match(
    new RegExp(`export const ${name}\\s*=\\s*([0-9_]+)n`),
  );
  if (!hit) throw new Error(`${name} not found in rail-config.ts`);
  return BigInt(hit[1].replace(/_/g, ""));
}

function numberConst(name: string): number {
  const hit = railConfig.match(new RegExp(`export const ${name}\\s*=\\s*(\\d+)`));
  if (!hit) throw new Error(`${name} not found in rail-config.ts`);
  return Number(hit[1]);
}

describe("published prices match the app", () => {
  it("reads a real config, not an empty string", () => {
    // Guard the guard: a bad path would make every case below vacuous.
    expect(railConfig).toContain("PEONES_UNIT_PRICE_USD6");
  });

  it("charges the same per Peón", () => {
    expect(PEONES_UNIT_PRICE_USD6).toBe(bigintConst("PEONES_UNIT_PRICE_USD6"));
  });

  it("offers the same Peones range", () => {
    expect(PEONES_MIN_AMOUNT).toBe(numberConst("PEONES_MIN_AMOUNT"));
    expect(PEONES_MAX_AMOUNT).toBe(numberConst("PEONES_MAX_AMOUNT"));
  });

  it("quotes the same PRO price and duration", () => {
    // PRO is an object literal, not a top-level const, so match its fields.
    expect(railConfig).toMatch(/priceUsd6:\s*1_990_000n/);
    expect(PRO_PRICE_USD6).toBe(1_990_000n);
    expect(railConfig).toMatch(/durationDays:\s*30/);
    expect(PRO_DURATION_DAYS).toBe(30);
  });

  it("⛔ never lists the paused Season Pass", () => {
    // The app still HAS the pass — buyers keep it — but nobody can purchase
    // one, and a price for something unbuyable is the one thing this page
    // must not publish.
    const text = JSON.stringify(PLANS).toLowerCase();
    expect(text).not.toContain("season pass");
    expect(text).not.toContain("21-day");
    expect(text).not.toContain("$0.99");
  });

  it("renders money as dollars and cents", () => {
    expect(formatUsd6(10_000n)).toBe("$0.01");
    expect(formatUsd6(1_990_000n)).toBe("$1.99");
    expect(formatUsd6(50_000n)).toBe("$0.05");
  });

  it("shows the cheapest real entry point, not a made-up one", () => {
    const peones = PLANS.find((p) => p.id === "peones");
    // 5 Peones at $0.01 is the smallest purchase the app accepts.
    expect(peones?.price).toBe("$0.05+");
  });
});
