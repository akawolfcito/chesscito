import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Anti-AI-prose guard for editorial.ts.
 *
 * Policy (memory: anti-ai-prose): user-facing copy must avoid em-dash (—)
 * and en-dash (–) because dash-heavy prose reads as AI-generated. The
 * source of truth for UI copy is `editorial.ts`.
 *
 * This test snapshots the CURRENT count of dashes as a ceiling. New PRs
 * may not increase the count. As copy is rewritten and dashes drop, lower
 * the baseline in the same commit so the floor walks down monotonically.
 *
 * Baseline captured 2026-05-30. Target: 0.
 */
const EM_DASH_CEILING = 181;
const EN_DASH_CEILING = 4;

function countOccurrences(source: string, char: string): number {
  let n = 0;
  for (const ch of source) if (ch === char) n += 1;
  return n;
}

describe("editorial.ts anti-AI-prose guard", () => {
  const path = join(__dirname, "..", "editorial.ts");
  const source = readFileSync(path, "utf-8");

  it(`does not exceed the em-dash (—) ceiling of ${EM_DASH_CEILING}`, () => {
    const count = countOccurrences(source, "—");
    expect(
      count,
      `em-dash count is ${count}, ceiling is ${EM_DASH_CEILING}. ` +
        `If you added one, rewrite with commas/periods. ` +
        `If you removed some, lower EM_DASH_CEILING to ${count} in the same commit.`,
    ).toBeLessThanOrEqual(EM_DASH_CEILING);
  });

  it(`does not exceed the en-dash (–) ceiling of ${EN_DASH_CEILING}`, () => {
    const count = countOccurrences(source, "–");
    expect(
      count,
      `en-dash count is ${count}, ceiling is ${EN_DASH_CEILING}. ` +
        `If you added one, rewrite with commas/periods. ` +
        `If you removed some, lower EN_DASH_CEILING to ${count} in the same commit.`,
    ).toBeLessThanOrEqual(EN_DASH_CEILING);
  });
});
