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

import {
  THEMES,
  DEFAULT_THEME_ID,
  type SingleFileFormat,
  type ThemeAssetKey,
} from "../theme-registry";
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

/** Every file a slot must ship. A slot that declares `format` is ONE file with
 *  that extension (an .ico, an Open Graph .jpg); everything else is the
 *  PNG/WebP/AVIF triplet. */
function hasAllFiles(
  root: string,
  basename: string,
  format?: SingleFileFormat,
): boolean {
  const extensions = format ? [format] : ["png", "webp", "avif"];
  return extensions.every((extension) =>
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
        // Live slots (2026-07-29 redesign): one illustration per slide, and
        // title art per locale for slides 2-4.
        "landing.slide1-bg",
        "landing.slide2-bg",
        "landing.slide3-bg",
        "landing.slide4-bg",
        "landing.slide1-title",
        "landing.slide2-title-en",
        "landing.slide2-title-es",
        "landing.slide3-title-en",
        "landing.slide3-title-es",
        "landing.slide4-title-en",
        "landing.slide4-title-es",
        "landing.season-pass-icon",
        "landing.pro-icon",
        // Superseded but still on disk, so still replaceable.
        "landing.slides-frame",
        "landing.slides-scene-desktop",
        "landing.slide1-avatar",
        "landing.slide2-avatar",
        "landing.slide2-title",
        "landing.slide3-avatar",
        "landing.slide3-title",
        "landing.slide4-avatar",
      ]),
    );
  });

  it("gives slides 2-4 a separate title slot per locale", () => {
    const byKey = new Map(landingSlots);
    // The whole reason these are two slots and not one: the files differ, so
    // a single slot would have let someone replace the English wordmark and
    // silently leave the Spanish one behind.
    for (const step of [2, 3, 4]) {
      const en = byKey.get(`landing.slide${step}-title-en` as ThemeAssetKey);
      const es = byKey.get(`landing.slide${step}-title-es` as ThemeAssetKey);
      expect(en?.default).toBeTruthy();
      expect(es?.default).not.toEqual(en?.default);
    }
    // Slide 1 is the deliberate exception — one file, both locales.
    expect(byKey.get("landing.slide1-title")?.default).toBe(
      "/art/landing-slides/title-chesscito",
    );
  });

  it("ships every landing slot's files inside apps/landing/public", () => {
    const missing = landingSlots.flatMap(([key, entry]) =>
      basenamesOf(entry)
        .filter((basename) => !hasAllFiles(LANDING_PUBLIC, basename, entry.format))
        .map((basename) => `${key} → ${basename}`),
    );
    expect(missing).toEqual([]);
  });

  it("leaves no landing image outside the catalog or the sync manifest", () => {
    const literals = landingArtLiterals();
    // Guard the guard: a scanner that finds nothing would pass vacuously.
    // Sentinel updated 2026-07-29 — the old one (avatar-chesscito-welcome)
    // left the landing source with the slide redesign, so it stopped proving
    // the scanner works and started proving only that the art moved.
    expect(literals).toContain("/art/landing-slides/slide-bg-1");
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
      (basename) => !hasAllFiles(WEB_PUBLIC, basename),
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
