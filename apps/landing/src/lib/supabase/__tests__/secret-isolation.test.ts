/**
 * Structural guard: `chesscito-landing` gained its first service credential in
 * Phase B. This file exists to keep the property the project had before that
 * commit — no secret reachable from the browser — rather than to recover it
 * after a leak.
 *
 * Like `privy-isolation.test.ts`, the isolation is a compile-time property of
 * the import graph, so these assertions scan source text instead of asserting
 * a runtime absence that a bundler decision could invalidate.
 *
 * Plan: docs/plans/2026-08-04-stats-consolidation-execution-plan.md, Phase B.
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

import { describe, expect, it } from "vitest";

// vitest runs with the package root as cwd (apps/landing).
const APP_ROOT = process.cwd();
const SRC_ROOT = join(APP_ROOT, "src");
const COMPONENTS_ROOT = join(SRC_ROOT, "components");
const STATIC_ROOT = join(APP_ROOT, ".next", "static");

// These two files name the forbidden strings on purpose — the client module
// reads them, this guard searches for them. Excluding them by basename keeps
// the scan honest without weakening it for every other file.
const SELF_EXEMPT = new Set(["secret-isolation.test.ts", "server-only.test.ts"]);
const CLIENT_MODULE = join(SRC_ROOT, "lib", "supabase", "server.ts");

// Must stay byte-identical to the sentinel in `server-only.test.ts` and to the
// value used for the degraded-build check documented in the Phase B handoff.
const SENTINEL_KEY = "phase-b-sentinel-service-role-key-not-a-real-credential";

function sourceFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules") continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...sourceFiles(full));
    else if (/\.(ts|tsx|js|jsx)$/.test(entry.name) && !SELF_EXEMPT.has(entry.name))
      out.push(full);
  }
  return out;
}

function bundleFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...bundleFiles(full));
    else if (statSync(full).isFile()) out.push(full);
  }
  return out;
}

const SRC_FILES = sourceFiles(SRC_ROOT);
const COMPONENT_FILES = sourceFiles(COMPONENTS_ROOT);
const CLIENT_COMPONENTS = SRC_FILES.filter((file) =>
  /^\s*["']use client["']/m.test(readFileSync(file, "utf8")),
);

const rel = (file: string) => relative(APP_ROOT, file);

describe("landing secret isolation — scan coverage", () => {
  it("scans a non-trivial number of landing source files", () => {
    expect(SRC_FILES.length).toBeGreaterThan(10);
  });

  it("scans the components tree", () => {
    expect(COMPONENT_FILES.length).toBeGreaterThan(3);
  });

  it("finds the client components it claims to check", () => {
    // Without this, a change to the `"use client"` detection would silently
    // reduce the client-component checks below to zero files and stay green.
    expect(CLIENT_COMPONENTS.length).toBeGreaterThan(0);
  });

  it("the module under guard is not itself exempt from the tree scan", () => {
    expect(SRC_FILES).toContain(CLIENT_MODULE);
  });
});

describe("no Supabase variable is ever public", () => {
  for (const name of [
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "NEXT_PUBLIC_SUPABASE",
  ]) {
    it(`no landing source mentions ${name}`, () => {
      const offenders = SRC_FILES.filter((file) =>
        readFileSync(file, "utf8").includes(name),
      ).map(rel);
      expect(offenders).toEqual([]);
    });
  }

  it("next.config.js does not forward a Supabase variable to the bundle", () => {
    // The `env` block in next.config.js inlines whatever it lists into the
    // client bundle, prefix or no prefix. It currently forwards only
    // NEXT_PUBLIC_BUILD_SHA; adding a Supabase name there would defeat every
    // other guard in this file.
    const config = readFileSync(join(APP_ROOT, "next.config.js"), "utf8");
    expect(config).not.toMatch(/SUPABASE/i);
  });
});

describe("no credential reaches the components tree", () => {
  for (const token of [
    "SUPABASE_SERVICE_ROLE_KEY",
    "SUPABASE_URL",
    "createClient",
    "@supabase/supabase-js",
  ]) {
    it(`no file under src/components mentions ${token}`, () => {
      const offenders = COMPONENT_FILES.filter((file) =>
        readFileSync(file, "utf8").includes(token),
      ).map(rel);
      expect(offenders).toEqual([]);
    });
  }

  it("no file under src/components imports lib/supabase", () => {
    const offenders = COMPONENT_FILES.filter((file) =>
      /from\s+["'][^"']*(?:@\/lib\/supabase|\.\.\/lib\/supabase|lib\/supabase)/.test(
        readFileSync(file, "utf8"),
      ),
    ).map(rel);
    expect(offenders).toEqual([]);
  });
});

describe("client components stay free of server env", () => {
  it("no client component imports the Supabase server module", () => {
    const offenders = CLIENT_COMPONENTS.filter((file) =>
      /["'][^"']*lib\/supabase\/server["']/.test(readFileSync(file, "utf8")),
    ).map(rel);
    expect(offenders).toEqual([]);
  });

  it("no client component reads process.env at all", () => {
    // Deliberately stricter than "reads no secret": a `"use client"` file has
    // no server env to read, and every value it could read is inlined into the
    // bundle. Zero is a checkable line; "only the safe ones" is not.
    const offenders = CLIENT_COMPONENTS.filter((file) =>
      /process\s*\.\s*env/.test(readFileSync(file, "utf8")),
    ).map(rel);
    expect(offenders).toEqual([]);
  });

  it("the Supabase server module is not a client component", () => {
    expect(readFileSync(CLIENT_MODULE, "utf8")).not.toMatch(
      /^\s*["']use client["']/m,
    );
  });
});

describe("static bundle", () => {
  const built = existsSync(STATIC_ROOT);
  const files = bundleFiles(STATIC_ROOT);

  // `.next/static` only exists after a build. These cases are SKIPPED rather
  // than vacuously green when it is absent, so an unbuilt run is visible in
  // the report instead of reading as a passing guard.
  it.skipIf(!built)("has chunks to scan", () => {
    expect(files.length).toBeGreaterThan(0);
  });

  for (const token of ["SUPABASE_SERVICE_ROLE_KEY", SENTINEL_KEY]) {
    it.skipIf(!built)(`contains no occurrence of ${token.slice(0, 24)}…`, () => {
      const offenders = files
        .filter((file) => readFileSync(file, "utf8").includes(token))
        .map(rel);
      expect(offenders).toEqual([]);
    });
  }
});
