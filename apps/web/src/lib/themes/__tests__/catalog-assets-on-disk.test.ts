/**
 * Existence guard for cataloged art.
 *
 * `asset-integrity.test.ts` generates one test per hardcoded `/art/...`
 * literal it finds in the source. Catalog slots store an extension-less
 * basename and are resolved at runtime, so that scanner never sees them:
 * every surface that migrated from a hardcoded path to `useThemeAsset`
 * silently LOST its on-disk check. Cataloging arena.rival-mara made the
 * hole visible — it removed 3 generated tests and added no replacement.
 *
 * This closes it for all web-owned slots. The landing-owned ones are
 * covered by landing-assets.test.ts.
 */
import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { THEMES, DEFAULT_THEME_ID } from "../theme-registry";
import { resolveAppRoot } from "../asset-roots";
import { resolveAssetVariant } from "../asset-variant";

const WEB_PUBLIC = path.join(resolveAppRoot("web"), "public");
const FORMATS = ["png", "webp", "avif"] as const;

const assets = THEMES[DEFAULT_THEME_ID].assets;

/** Every (slot, variant) that names a real basename in the web app. */
const webTargets = Object.entries(assets)
  .filter(([, entry]) => (entry.root ?? "web") === "web")
  .flatMap(([key, entry]) =>
    (["default", "pro"] as const).flatMap((variant) => {
      const resolved = resolveAssetVariant(entry, variant);
      return resolved.mode === "asset"
        ? [{ key, variant, basename: resolved.path }]
        : [];
    }),
  );

function formatsOnDisk(basename: string): string[] {
  return FORMATS.filter((format) =>
    existsSync(path.join(WEB_PUBLIC, `${basename.replace(/^\//, "")}.${format}`)),
  );
}

describe("cataloged art exists on disk", () => {
  it("covers the whole web-owned catalog", () => {
    // Guard the guard — a filter bug here would make everything below vacuous.
    expect(webTargets.length).toBeGreaterThan(150);
  });

  it("resolves every cataloged slot to at least one real file", () => {
    const missing = webTargets
      .filter((target) => formatsOnDisk(target.basename).length === 0)
      .map((target) => `${target.key}/${target.variant} → ${target.basename}`);
    expect(missing).toEqual([]);
  });

  it("keeps the arena rivals replaceable, art included", () => {
    // The regression that started this: Mara rendered from a hardcoded
    // <picture> with no slot, so the builder could not touch her.
    for (const slot of ["arena.rival-pipo", "arena.rival-mara", "arena.rival-kairo"]) {
      const entry = assets[slot as keyof typeof assets];
      const resolved = resolveAssetVariant(entry, "default");
      expect(resolved.mode).toBe("asset");
      if (resolved.mode !== "asset") return;
      expect(formatsOnDisk(resolved.path)).toEqual(["png", "webp", "avif"]);
    }
  });
});
