/**
 * Enforces §3.5 (Puntuación) of `docs/content/chesscito-language-brief.md`.
 *
 * The brief said "no em-dashes" in prose, which is a comment, not a control —
 * and this repo has paid for that difference before. The copy measured clean on
 * 2026-08-23 (zero em-dashes, ellipsis consistently `...`); this keeps it that
 * way instead of hoping.
 *
 * ⛔ It walks the EXPORTED VALUES, it does not parse the source. The first
 * version scanned `"..."` literals with a regex and drowned in false positives
 * the moment it met real code — `field = ""` and template strings desync the
 * quote pairing, so it reported `catalog.ts: );` as player copy. Importing the
 * module gives exactly the strings that ship and nothing else.
 *
 * ⚠️ Em-dashes stay welcome in code comments and in docs (including the brief
 * itself). This is the player's copy, not the repo's prose.
 */
import { describe, expect, it } from "vitest";

import * as editorial from "../editorial";

/** Stand-in for the interpolated value of a copy template. */
const SAMPLE = "Rook";

type Found = { readonly path: string; readonly value: string };

/**
 * Every string a copy module can render, templates included.
 *
 * Functions are copy too — `nextPiece: (piece) => \`Start ${piece}\`` ships a
 * string the player reads — so they are called with a placeholder rather than
 * skipped. A template that throws on a sample argument is not copy, and is
 * dropped.
 */
function collect(node: unknown, at: string, into: Found[], depth = 0): void {
  if (depth > 8) return;

  if (typeof node === "string") {
    into.push({ path: at, value: node });
    return;
  }

  if (typeof node === "function") {
    try {
      const produced = (node as (...args: unknown[]) => unknown)(SAMPLE, SAMPLE);
      if (typeof produced === "string") into.push({ path: at, value: produced });
    } catch {
      /* needs a shaped argument — not a copy template */
    }
    return;
  }

  if (node && typeof node === "object") {
    for (const [key, child] of Object.entries(node)) {
      collect(child, `${at}.${key}`, into, depth + 1);
    }
  }
}

const ALL: Found[] = [];
collect(editorial, "editorial", ALL);

/**
 * Namespaces where full prose is allowed — level 3 of the brief's exposure
 * hierarchy (§5): legal text, dev-only strings and docs are not player copy.
 */
const PROSE_ALLOWED = /LEGAL|TERMS|PRIVACY|SUPPORT_COPY\.body|README/i;

const PLAYER_COPY = ALL.filter(({ path }) => !PROSE_ALLOWED.test(path));

function offenders(mark: string): string[] {
  return PLAYER_COPY.filter(({ value }) => value.includes(mark))
    .map(({ path, value }) => `${path}: ${value.slice(0, 60)}`)
    .sort();
}

describe("language brief §3.5 — punctuation", () => {
  it("walks a real corpus", () => {
    // Guard the guard: an import or traversal bug would make the rest vacuous.
    expect(PLAYER_COPY.length).toBeGreaterThan(500);
  });

  it("never uses an em-dash in player copy", () => {
    // At 390px an em-dash buries a subordinate clause where the player
    // expected the line to end. Two short sentences instead.
    expect(offenders("—")).toEqual([]);
  });

  it("never uses a semicolon in player copy", () => {
    expect(offenders(";")).toEqual([]);
  });

  it("writes ellipsis as one character, never three dots", () => {
    // ⛔ The corpus had BOTH, for the same states: "Saving…" and "Saving...".
    // The two render nearly identically, so the split survived every review and
    // only showed up when this test walked the values (2026-08-23). `…` won on
    // the count (28 vs 17) and because one glyph is narrower than three dots,
    // which matters inside a 155px label.
    expect(offenders("...")).toEqual([]);
  });
});
