/**
 * Coverage guard for the sibling landing app.
 *
 * `audit-theme-runtime-coverage.mjs` proves every web-owned slot reaches a
 * consumer inside `apps/web`. It cannot see `apps/landing`, so this test is
 * the other half: every image the landing renders is either a cataloged
 * landing slot (replaceable from /dev/theme-builder) or a web asset mirrored
 * by the sync script — never an orphan nobody can update.
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { THEMES, DEFAULT_THEME_ID } from "../theme-registry";
import { resolveAppRoot } from "../asset-roots";
import { SHARED_LANDING_ASSETS } from "../shared-landing-assets";
import { resolveAssetVariant } from "../asset-variant";

const LANDING_ROOT = resolveAppRoot("landing");
const LANDING_SRC = path.join(LANDING_ROOT, "src");
const LANDING_PUBLIC = path.join(LANDING_ROOT, "public");
const WEB_PUBLIC = path.join(resolveAppRoot("web"), "public");

/** Static `/art/...` literals. Stops before `${` so a composed family like
 *  `/art/redesign/icons/${name}` yields the prefix, not a bogus basename. */
const ART_LITERAL_RE = /["'`](\/art\/[^"'`\s${),;]+)/g;
const IMAGE_EXT_RE = /\.(?:avif|png|webp)$/;

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const absolute = path.join(dir, entry);
    if (statSync(absolute).isDirectory()) return walk(absolute);
    return /\.tsx?$/.test(entry) && !absolute.includes("__tests__")
      ? [absolute]
      : [];
  });
}

function landingArtLiterals(): string[] {
  const found = new Set<string>();
  for (const file of walk(LANDING_SRC)) {
    for (const match of readFileSync(file, "utf8").matchAll(ART_LITERAL_RE)) {
      const basename = match[1].replace(IMAGE_EXT_RE, "");
      // A trailing slash means the tail was interpolated — that family is
      // asserted separately, by name, below.
      if (!basename.endsWith("/")) found.add(basename);
    }
  }
  return [...found].sort();
}

const assets = THEMES[DEFAULT_THEME_ID].assets;
const landingSlots = Object.entries(assets).filter(
  ([, entry]) => entry.root === "landing",
);

function basenamesOf(entry: (typeof assets)[keyof typeof assets]): string[] {
  return (["default", "pro"] as const)
    .map((variant) => resolveAssetVariant(entry, variant))
    .flatMap((resolved) => (resolved.mode === "asset" ? [resolved.path] : []));
}

function hasTriplet(root: string, basename: string): boolean {
  return ["png", "webp", "avif"].every((extension) =>
    existsSync(path.join(root, `${basename.replace(/^\//, "")}.${extension}`)),
  );
}

/** Icon names the landing's CandyIcon can render — the union is the contract,
 *  since the path is composed at runtime and no literal exists to grep. */
function candyIconNames(): string[] {
  const source = readFileSync(
    path.join(LANDING_SRC, "components/redesign/candy-icon.tsx"),
    "utf8",
  );
  const union = source.slice(
    source.indexOf("export type CandyIconName"),
    source.indexOf(";", source.indexOf("export type CandyIconName")),
  );
  return [...union.matchAll(/"([a-z-]+)"/g)].map((match) => match[1]).sort();
}

describe("landing art coverage", () => {
  it("catalogs the whole onboarding carousel", () => {
    const keys = landingSlots.map(([key]) => key);
    expect(keys).toEqual(
      expect.arrayContaining([
        "landing.slides-frame",
        "landing.slides-scene-desktop",
        "landing.slide1-avatar",
        "landing.slide1-title",
        "landing.slide2-avatar",
        "landing.slide2-title",
        "landing.slide3-avatar",
        "landing.slide3-title",
        "landing.slide4-avatar",
        "landing.season-pass-icon",
        "landing.pro-icon",
      ]),
    );
  });

  it("ships every landing slot's triplet inside apps/landing/public", () => {
    const missing = landingSlots.flatMap(([key, entry]) =>
      basenamesOf(entry)
        .filter((basename) => !hasTriplet(LANDING_PUBLIC, basename))
        .map((basename) => `${key} → ${basename}`),
    );
    expect(missing).toEqual([]);
  });

  it("leaves no landing image outside the catalog or the sync manifest", () => {
    const literals = landingArtLiterals();
    // Guard the guard: a scanner that finds nothing would pass vacuously.
    expect(literals).toContain("/art/landing-slides/avatar-chesscito-welcome");
    expect(literals.length).toBeGreaterThan(15);

    const cataloged = new Set(landingSlots.flatMap(([, e]) => basenamesOf(e)));
    const shared = new Set<string>(SHARED_LANDING_ASSETS);
    const orphans = literals.filter(
      (basename) => !cataloged.has(basename) && !shared.has(basename),
    );
    expect(orphans).toEqual([]);
  });

  it("mirrors the full CandyIcon family, whose paths are composed at runtime", () => {
    const shared = new Set<string>(SHARED_LANDING_ASSETS);
    const unmirrored = candyIconNames().filter(
      (name) => !shared.has(`/art/redesign/icons/${name}`),
    );
    expect(unmirrored).toEqual([]);
  });

  it("keeps every shared asset resolvable from the web app it is copied from", () => {
    const missing = SHARED_LANDING_ASSETS.filter(
      (basename) => !hasTriplet(WEB_PUBLIC, basename),
    );
    expect(missing).toEqual([]);
  });

  it("keeps every shared asset byte-identical across the two apps", () => {
    // The drift this catches is silent by nature: both files exist, both
    // render, and only one of them got the new art. Run
    // `pnpm art:sync-landing` to converge.
    const drifted = SHARED_LANDING_ASSETS.flatMap((basename) =>
      ["png", "webp", "avif"]
        .map((extension) => `${basename.replace(/^\//, "")}.${extension}`)
        .filter(
          (relative) =>
            !readFileSync(path.join(WEB_PUBLIC, relative)).equals(
              readFileSync(path.join(LANDING_PUBLIC, relative)),
            ),
        ),
    );
    expect(drifted).toEqual([]);
  });

  it("never mirrors a landing-owned slot back from the web app", () => {
    // apps/web/public still holds stale copies of /art/landing/*. Syncing
    // those would overwrite the live landing art with the orphan.
    const cataloged = new Set(landingSlots.flatMap(([, e]) => basenamesOf(e)));
    const conflicts = SHARED_LANDING_ASSETS.filter((b) => cataloged.has(b));
    expect(conflicts).toEqual([]);
  });
});
