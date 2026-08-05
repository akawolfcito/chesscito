/**
 * Guard for the production cache incident of 2026-08-05.
 *
 * 🔬 The defect: `unstable_cache` was wrapped INSIDE `loadStatsSnapshot`, so
 * every render handed Next a brand-new closure. Next derives part of an entry's
 * identity from the callback it receives, so each request minted a fresh entry
 * and `/stats` regenerated on every visit — 11 RPCs plus the on-chain block plus
 * the census, per visitor, with one connection hanging for 38.8 s.
 *
 * ⚠️ **No behavioural test can catch this**, and one already failed to. Under
 * `next start` there is ONE long-lived process, so a fresh closure still lands
 * on the same in-memory store: a local counterfactual with the broken code
 * measured a clean cache hit and cleared it. Only the Vercel runtime, where
 * every invocation starts from a freshly loaded module, exposes it.
 *
 * That is why this is a SOURCE guard. It reads the module text and fails if the
 * wrapper construction moves back into a function that runs per request.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { CENSUS_KEY_PARTS, snapshotKeyParts, STATS_CACHE_TAG } from "../snapshot";
import type { ContainerFilter, SurfaceFilter } from "../filters";

const APP_ROOT = process.cwd();
const SNAPSHOT = join(APP_ROOT, "src/lib/stats/snapshot.ts");
const PAGE = join(APP_ROOT, "src/app/stats/page.tsx");

const strip = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

const snapshotCode = strip(readFileSync(SNAPSHOT, "utf8"));
const pageCode = strip(readFileSync(PAGE, "utf8"));

/** The body of a named function declaration, brace-matched. */
function bodyOf(src: string, name: string): string {
  const start = src.indexOf(`function ${name}(`);
  if (start === -1) return "";
  const open = src.indexOf("{", start);
  let depth = 0;
  for (let i = open; i < src.length; i += 1) {
    if (src[i] === "{") depth += 1;
    else if (src[i] === "}") {
      depth -= 1;
      if (depth === 0) return src.slice(open, i + 1);
    }
  }
  return src.slice(open);
}

describe("the guard can see what it guards", () => {
  it("reads both files and finds the two loaders", () => {
    // Without this, a rename would turn every assertion below into a vacuous
    // pass over an empty string — the failure mode this file exists to prevent.
    expect(snapshotCode).toContain("export function loadStatsSnapshot");
    expect(snapshotCode).toContain("export function loadPlayersCensus");
    expect(bodyOf(snapshotCode, "loadStatsSnapshot").length).toBeGreaterThan(20);
    expect(bodyOf(snapshotCode, "loadPlayersCensus").length).toBeGreaterThan(20);
  });
});

describe("no per-request wrapper construction", () => {
  /**
   * ⚠️ The rule is NOT "never name `unstable_cache` in a loader" — the correct
   * code names it, inside a lazy init. And the rule is NOT "never CALL
   * `unstable_cache(`" either: the real defect never wrote a call site, it
   * PASSED `unstable_cache` into a factory that called it, so a call-site guard
   * would have watched the incident happen. (Both of those wrong rules were
   * written first and rejected by the counterfactual.)
   *
   * The rule that is actually true of the fix and false of the defect:
   * **if a per-request function reaches for the wrapper machinery at all, that
   * reach must sit behind a memo check.**
   */
  for (const name of ["loadStatsSnapshot", "loadPlayersCensus"]) {
    it(`${name} only builds a wrapper behind a memo check`, () => {
      const body = bodyOf(snapshotCode, name);
      const reaches = /unstable_cache|create(Snapshot|Census)Loader\s*\(/.test(body);
      if (!reaches) return; // fine: nothing constructed per request
      expect(body, `${name} must guard the construction`).toMatch(/if\s*\(\s*!\w+/);
      // …and the guarded value has to be stored, or the memo never fills.
      expect(body, `${name} must persist what it built`).toMatch(
        /(snapshotLoaders\.set|censusLoader\s*=)/,
      );
    });
  }

  it("page.tsx builds no wrapper of its own", () => {
    expect(pageCode).not.toMatch(/unstable_cache/);
    expect(pageCode).not.toMatch(/create(Snapshot|Census)Loader/);
  });

  it("the page still renders per request — the fix must not make it static", () => {
    expect(pageCode).toMatch(/export const dynamic = "force-dynamic"/);
  });
});

describe("the wrappers are memoised at module scope", () => {
  it("a module-level registry exists for snapshots", () => {
    expect(snapshotCode).toMatch(/^const snapshotLoaders = new Map</m);
  });

  it("a module-level slot exists for the census", () => {
    expect(snapshotCode).toMatch(/^let censusLoader/m);
  });

  it("the registry is keyed by the normalised snapshot key", () => {
    expect(bodyOf(snapshotCode, "loadStatsSnapshot")).toMatch(/snapshotKeyParts\(filters\)/);
  });

  it("the postmortem comment stays beside the code", () => {
    // The prose replicates with the code, so the prose has to be right — and
    // this one is the only warning a future editor will get.
    const raw = readFileSync(SNAPSHOT, "utf8");
    expect(raw).toContain("Do not construct this unstable_cache wrapper per request");
    expect(raw).toContain("long-lived process");
  });
});

describe("the key space is bounded and normalised", () => {
  const SURFACES: SurfaceFilter[] = ["all", "learn", "play"];
  const CONTAINERS: ContainerFilter[] = ["all", "minipay", "browser"];

  it("is exactly surface × container — nine combinations, no more", () => {
    const keys = new Set<string>();
    for (const surface of SURFACES) {
      for (const container of CONTAINERS) {
        keys.add(snapshotKeyParts({ surface, container }).join("::"));
      }
    }
    expect(keys.size).toBe(9);
  });

  it("carries no locale", () => {
    for (const surface of SURFACES) {
      for (const container of CONTAINERS) {
        const parts = snapshotKeyParts({ surface, container });
        expect(parts).toHaveLength(3);
        expect(parts.join(" ")).not.toMatch(/\b(en|es|locale)\b/);
      }
    }
  });

  it("`all` has ONE spelling, so two equivalent filters cannot split an entry", () => {
    const a = snapshotKeyParts({ surface: "all", container: "all" }).join("::");
    const b = snapshotKeyParts({ surface: "all", container: "all" }).join("::");
    expect(a).toBe(b);
    expect(a).toBe("public-stats::all::all");
  });

  it("the census key is filter-free and distinct from every snapshot key", () => {
    const census = [...CENSUS_KEY_PARTS].join("::");
    expect(census).toBe("public-stats::census");
    for (const surface of SURFACES) {
      for (const container of CONTAINERS) {
        expect(snapshotKeyParts({ surface, container }).join("::")).not.toBe(census);
      }
    }
  });

  it("every key sits under the single tag", () => {
    expect(STATS_CACHE_TAG).toBe("public-stats");
    expect(snapshotKeyParts({ surface: "play", container: "minipay" })[0]).toBe(
      STATS_CACHE_TAG,
    );
  });
});
