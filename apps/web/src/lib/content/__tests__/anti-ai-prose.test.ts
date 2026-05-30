import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Anti-AI-prose guard for the user-facing copy surface.
 *
 * Policy (memory: anti-ai-prose): user-facing copy must avoid em-dash (—)
 * and en-dash (–) because dash-heavy prose reads as AI-generated. The
 * sources of truth are `editorial.ts` (EN defaults + types) and
 * `messages/{en,es}.ts` (locale overrides loaded by next-intl).
 *
 * Scope: dashes inside JSDoc and line comments are dev-only notes, not
 * user-facing copy, so they are excluded. Each ceiling reflects only the
 * count in non-comment positions (string literals, template literals).
 *
 * New PRs may not increase any count. As copy is rewritten and dashes
 * drop, lower the ceiling in the same commit so the floor walks down
 * monotonically toward zero.
 *
 * Baseline captured 2026-05-30 after chunk 1 sweep (REWARD_COPY
 * ariaLabels + pawn lockedHint). Target: 0.
 */
const COPY_SOURCES = [
  { file: "editorial.ts", emCeiling: 58, enCeiling: 1 },
  { file: "messages/en.ts", emCeiling: 8, enCeiling: 0 },
  { file: "messages/es.ts", emCeiling: 59, enCeiling: 1 },
] as const;

/** Remove /* ... *​/ block comments and // line comments so the remaining
 *  text approximates the union of string literals + code identifiers.
 *  Em-dashes do not appear in identifiers; any residual count reflects
 *  user-facing copy. */
function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:'"`])\/\/.*$/gm, "$1");
}

function countOccurrences(source: string, char: string): number {
  let n = 0;
  for (const ch of source) if (ch === char) n += 1;
  return n;
}

describe("anti-AI-prose guard (editorial + i18n)", () => {
  for (const { file, emCeiling, enCeiling } of COPY_SOURCES) {
    describe(file, () => {
      const path = join(__dirname, "..", file);
      const source = stripComments(readFileSync(path, "utf-8"));

      it(`does not exceed the em-dash (—) ceiling of ${emCeiling}`, () => {
        const count = countOccurrences(source, "—");
        expect(
          count,
          `${file} em-dash count is ${count}, ceiling is ${emCeiling}. ` +
            `If you added one, rewrite with commas/periods. ` +
            `If you removed some, lower the ceiling for ${file} to ${count} in the same commit.`,
        ).toBeLessThanOrEqual(emCeiling);
      });

      it(`does not exceed the en-dash (–) ceiling of ${enCeiling}`, () => {
        const count = countOccurrences(source, "–");
        expect(
          count,
          `${file} en-dash count is ${count}, ceiling is ${enCeiling}. ` +
            `If you added one, rewrite with commas/periods. ` +
            `If you removed some, lower the ceiling for ${file} to ${count} in the same commit.`,
        ).toBeLessThanOrEqual(enCeiling);
      });
    });
  }
});
