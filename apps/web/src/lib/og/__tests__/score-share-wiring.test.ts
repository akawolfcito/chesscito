/**
 * Slice A — SaveScore share wiring guard.
 *
 * The score share card must point at the leaderboard-first OG type
 * (`score-saved`), NEVER at `piece-complete` (which renders the
 * "{Piece} Mastered" art). Both callsites are guarded:
 *   1. result-overlay.tsx (the in-modal preview image).
 *   2. share/score/page.tsx (the canonical OG meta crawlers fetch).
 *
 * Text-based guard (mirrors the schema-guard pattern) — getCardUrl is a
 * local fn and the page metadata is a server component, neither cleanly
 * unit-testable, so we assert the wiring at the source.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/** Read source with comments stripped — explanatory comments may NAME the
 *  old `type=piece-complete`; only the live code wiring is asserted. */
function readCode(rel: string): string {
  return readFileSync(join(process.cwd(), rel), "utf-8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "");
}

describe("result-overlay score share wiring", () => {
  const src = readCode("src/components/exercises/result-overlay.tsx");
  // Isolate the score-variant branch of getCardUrl (first occurrence).
  const scoreBranch = (() => {
    const i = src.indexOf('if (variant === "score")');
    expect(i).toBeGreaterThan(-1);
    return src.slice(i, i + 280);
  })();

  it("score card uses type=score-saved", () => {
    expect(scoreBranch).toMatch(/type=score-saved/);
  });

  it("score card does NOT use type=piece-complete", () => {
    expect(scoreBranch).not.toMatch(/type=piece-complete/);
  });
});

describe("share/score page OG wiring", () => {
  const src = readCode("src/app/[locale]/share/score/page.tsx");

  it("ogImage uses type=score-saved", () => {
    expect(src).toMatch(/api\/og\/exercise[^`'"]*type=score-saved/);
  });

  it("ogImage does NOT use type=piece-complete", () => {
    expect(src).not.toMatch(/type=piece-complete/);
  });
});
