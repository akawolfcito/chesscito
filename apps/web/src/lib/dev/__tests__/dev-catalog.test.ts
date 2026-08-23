/**
 * The catalog is DECLARED; these tests keep it honest against the source.
 *
 * `src/` does not exist in a serverless runtime, so `/dev` cannot read the
 * filesystem to build itself — the list has to be written down. Everything
 * written down rots, so every field is re-derived here and compared: routes,
 * variants, mounted components and consumers.
 *
 * ⛔ This is the whole reason the catalog can be trusted. `check-dev-probes.sh`
 * covers the same ground for routes alone and sat EIGHT routes stale for months
 * because nothing ran it. This runs in vitest, so it cannot be forgotten.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { DEV_CATALOG, DEV_SCREENS, devSurfaceHref } from "../dev-catalog";

const SRC = path.join(process.cwd(), "src");
const DEV_DIR = path.join(SRC, "app", "dev");

/** Every directory under app/dev that actually renders a page. */
function routesOnDisk(): string[] {
  return readdirSync(DEV_DIR)
    .filter((entry) => entry !== "__tests__")
    .filter((entry) => statSync(path.join(DEV_DIR, entry)).isDirectory())
    .filter((entry) => {
      try {
        return statSync(path.join(DEV_DIR, entry, "page.tsx")).isFile();
      } catch {
        return false;
      }
    })
    .sort();
}

/** Source of a route's page + fixture, concatenated. */
function routeSource(id: string): string {
  return ["page.tsx", "fixture.tsx"]
    .map((file) => {
      try {
        return readFileSync(path.join(DEV_DIR, id, file), "utf8");
      } catch {
        return "";
      }
    })
    .join("\n");
}

/** The string literals inside a route's own VARIANTS/STATES/FLOWS list. */
function declaredOptions(id: string): string[] {
  const source = routeSource(id);
  const found = new Set<string>();
  const lists = source.matchAll(
    /(?:VARIANTS|STATES|FLOWS)\b[^=]*=\s*(?:new Set(?:<[^>]*>)?\()?\s*\[([\s\S]*?)\]/g,
  );
  for (const list of lists) {
    for (const literal of list[1].matchAll(/"([^"]+)"/g)) {
      found.add(literal[1]);
    }
  }
  return [...found].sort();
}

/** Production components a route's fixture imports (dev/* excluded). */
function mountedComponents(id: string): string[] {
  const source = routeSource(id);
  const found = new Set<string>();
  for (const hit of source.matchAll(/from "@\/components\/([^"]+)"/g)) {
    if (!hit[1].startsWith("dev/") && hit[1] !== "wallet-provider") {
      found.add(hit[1]);
    }
  }
  return [...found].sort();
}

/** Every .tsx under src, minus tests and the dev surfaces themselves. */
function productionFiles(dir = SRC, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === "__tests__" || entry === "node_modules") continue;
      productionFiles(full, acc);
    } else if (entry.endsWith(".tsx")) {
      // Dev surfaces are not production: neither app/dev nor components/dev
      // counts as blast radius, or the builder's preview would show up as a
      // "consumer" of every lane-2 board it renders.
      const rel = path.relative(SRC, full);
      const isDevSurface =
        rel.startsWith(path.join("app", "dev")) ||
        rel.startsWith(path.join("components", "dev"));
      if (!isDevSurface) acc.push(rel);
    }
  }
  return acc;
}

const PRODUCTION_FILES = productionFiles();

/** Production files importing any of `components`. */
function consumersOf(components: readonly string[]): string[] {
  const found = new Set<string>();
  for (const rel of PRODUCTION_FILES) {
    const source = readFileSync(path.join(SRC, rel), "utf8");
    for (const component of components) {
      if (source.includes(`components/${component}"`)) {
        found.add(rel.split(path.sep).join("/"));
      }
    }
  }
  return [...found].sort();
}

describe("dev catalog — routes", () => {
  it("lists every /dev route, and no route that does not exist", () => {
    const onDisk = routesOnDisk();
    const catalogued = DEV_CATALOG.map((surface) => surface.id).sort();

    expect(catalogued).toEqual(onDisk);
  });

  it("never lists the same route twice", () => {
    const ids = DEV_CATALOG.map((surface) => surface.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("dev catalog — variants", () => {
  // The silent failure this closes: an unknown variant renders the DEFAULT
  // one, so a wrong name here shows the wrong screen without erroring.
  for (const surface of DEV_CATALOG.filter((entry) => entry.options)) {
    it(`lists the real options for /dev/${surface.id}`, () => {
      const declared = declaredOptions(surface.id);
      // A route may parse its param inline (pro-chip) rather than from a Set.
      if (declared.length === 0) return;

      expect([...(surface.options ?? [])].sort()).toEqual(declared);
    });
  }

  it("builds a href that carries the param", () => {
    const popups = DEV_SCREENS.find((s) => s.id === "exercises-popups");
    expect(devSurfaceHref(popups!, "score-saved")).toBe(
      "/dev/exercises-popups?variant=score-saved",
    );
    expect(devSurfaceHref(popups!)).toBe("/dev/exercises-popups");
  });
});

describe("dev catalog — what an edit here reaches", () => {
  for (const surface of DEV_CATALOG.filter((entry) => entry.mounts)) {
    it(`pins the components /dev/${surface.id} mounts`, () => {
      expect([...(surface.mounts ?? [])].sort()).toEqual(
        mountedComponents(surface.id),
      );
    });

    it(`pins the blast radius of /dev/${surface.id}`, () => {
      // ⛔ The founder's question in test form: restyling from this surface
      // moves exactly these files. If a new consumer appears, this fails and
      // the catalog gets updated — rather than the consumer being discovered
      // in a flow nobody walked.
      expect([...(surface.consumers ?? [])].sort()).toEqual(
        consumersOf(surface.mounts ?? []),
      );
    });
  }

  it("marks a forked fixture as a fork, and gives it no consumers", () => {
    const forks = DEV_CATALOG.filter((surface) => surface.fork);
    expect(forks.map((surface) => surface.id)).toEqual(["diagonal-run"]);

    for (const fork of forks) {
      // A fork that also mounted the real component would be a half-truth.
      expect(mountedComponents(fork.id)).toEqual([]);
      expect(fork.consumers).toBeUndefined();
    }
  });
});
