/**
 * The badge is earned by COMPLETION, not by stars — and the star pool is not a
 * fixed number either: it is `getMaxPossibleStars(piece, catalog)`, which moves
 * with the catalog and differs per piece.
 *
 * Two strings kept contradicting that after the rule changed, and commit
 * `484e3d7c` only caught two others. `badgeLockedFormat` was dead copy quoting a
 * star gate; `SHARE_COPY.badge` was LIVE copy with the pool size welded shut at
 * 15, so a bishop at 27/27 published "27/15 stars" — a number the player can see
 * is wrong, in the same panel that shows the right one.
 *
 * This file is the guard that keeps both classes out.
 */

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { SHARE_COPY, TRAINING_PATH_COPY } from "@/lib/content/editorial";
import en from "@/lib/content/messages/en";
import es from "@/lib/content/messages/es";

const SRC = join(process.cwd(), "src");

describe("SHARE_COPY.badge — the denominator is the piece's real ceiling", () => {
  it("never hardcodes a pool size", () => {
    // 27/27 for the bishop today; the literal 15 published 27/15.
    expect(SHARE_COPY.badge("Bishop", 27, 27)).toContain("27/27");
    expect(SHARE_COPY.badge("Bishop", 27, 27)).not.toContain("/15");
  });

  it("carries the same guarantee in both ICU bundles", () => {
    const enBadge = (en as Record<string, Record<string, unknown>>).SHARE_COPY
      .badge as string;
    const esBadge = (es as Record<string, Record<string, unknown>>).SHARE_COPY
      .badge as string;
    for (const template of [enBadge, esBadge]) {
      expect(template).toContain("{maxStars}");
      expect(template).not.toMatch(/\/\s*\d/);
    }
  });
});

/* ⚠️ `tsc` cannot see this. ICU arguments are untyped, so a call site that
 * forgets `maxStars` compiles clean and prints a broken sentence at runtime.
 * The /share/badge page was exactly that: it already normalized `maxStars` for
 * the OG image and the canonical URL, and still passed only `stars` to the
 * copy. Every consumer of the key is enumerated here on purpose — a new one
 * that forgets the argument fails this test instead of shipping. */
describe("every consumer of SHARE_COPY.badge passes the ceiling", () => {
  /** Walks the real tree instead of an allowlist: a surface added tomorrow is
   *  checked without anyone remembering to enumerate it here. */
  function* sourceFiles(dir: string): Generator<string> {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === "node_modules" || entry.name === "__tests__") continue;
        yield* sourceFiles(full);
      } else if (/\.tsx?$/.test(entry.name)) {
        yield full;
      }
    }
  }

  /** The argument list, to its BALANCED close. A `[^)]*` regex stops at the
   *  first inner `)` — `tPiece(pieceType ?? "rook")` — and reports a call that
   *  is perfectly fine. */
  function callsInSource(source: string): string[] {
    const calls: string[] = [];
    const opener = /tShare\(\s*["']badge["']/g;
    let match: RegExpExecArray | null;
    while ((match = opener.exec(source)) !== null) {
      let depth = 0;
      for (let i = source.indexOf("(", match.index); i < source.length; i += 1) {
        if (source[i] === "(") depth += 1;
        else if (source[i] === ")") {
          depth -= 1;
          if (depth === 0) {
            calls.push(source.slice(match.index, i + 1));
            break;
          }
        }
      }
    }
    return calls;
  }

  it("no call site omits maxStars", () => {
    const offenders: string[] = [];
    let callSites = 0;
    for (const file of sourceFiles(SRC)) {
      const source = readFileSync(file, "utf8");
      for (const call of callsInSource(source)) {
        callSites += 1;
        if (!call.includes("maxStars")) {
          offenders.push(`${file.slice(SRC.length + 1)} → ${call}`);
        }
      }
    }
    // The walk itself must find something, or a rename would make this pass by
    // finding nothing at all.
    expect(callSites).toBeGreaterThanOrEqual(2);
    expect(offenders).toEqual([]);
  });
});

describe("no surviving copy claims stars unlock the badge", () => {
  it("the dead star-gate key is gone, not preserved", () => {
    expect(TRAINING_PATH_COPY).not.toHaveProperty("badgeLockedFormat");
    expect((es as Record<string, Record<string, unknown>>).TRAINING_PATH_COPY)
      .not.toHaveProperty("badgeLockedFormat");
  });
});
