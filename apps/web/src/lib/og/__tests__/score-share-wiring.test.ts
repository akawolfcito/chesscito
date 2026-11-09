/**
 * Slice A — SaveScore share wiring guard.
 *
 * The score share card must point at the leaderboard-first OG type
 * (`score-saved`), NEVER at `piece-complete` (which renders the
 * "{Piece} Mastered" art). Both callsites are guarded:
 *   1. result-overlay.tsx (the in-modal preview image).
 *   2. share/score/page.tsx (the canonical OG meta crawlers fetch).
 *
 * getCardUrl is asserted on its OUTPUT (2026-07-09). It used to be a text
 * guard that sliced 280 chars after `if (variant === "score")` — it broke
 * the moment the two branches merged, and a regex over source cannot see
 * what the function actually returns. The page metadata is still a server
 * component, so that half stays a text guard.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { getCardUrl } from "@/components/exercises/result-overlay";

/** Read source with comments stripped — explanatory comments may NAME the
 *  old `type=piece-complete`; only the live code wiring is asserted. */
function readCode(rel: string): string {
  return readFileSync(join(process.cwd(), rel), "utf-8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "");
}

describe("result-overlay score share wiring", () => {
  it("score card uses type=score-saved", () => {
    expect(getCardUrl("score", "rook", 24, 30)).toContain("type=score-saved");
  });

  it("score card does NOT use type=piece-complete", () => {
    expect(getCardUrl("score", "rook", 24, 30)).not.toContain("type=piece-complete");
  });

  it("badge card uses type=badge-earned", () => {
    expect(getCardUrl("badge", "rook", 30, 30)).toContain("type=badge-earned");
  });

  it("carries the piece's real star ceiling, not the legacy 15", () => {
    const url = getCardUrl("badge", "rook", 24, 30);
    expect(url).toContain("stars=24");
    expect(url).toContain("max=30");
  });

  it("clamps stars to the ceiling it advertises", () => {
    expect(getCardUrl("badge", "rook", 999, 30)).toContain("stars=30");
  });

  it("falls back to the baseline pool when no ceiling is passed", () => {
    expect(getCardUrl("badge", "rook", 24)).toContain("max=30");
  });

  it("shop shares carry no stars at all", () => {
    expect(getCardUrl("shop")).toBe("/api/og/invite");
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
