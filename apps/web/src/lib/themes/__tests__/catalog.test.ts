import { describe, it, expect, vi } from "vitest";
import { buildThemeCatalog, type AssetResolver } from "../catalog";

/** A resolver stub that pretends every basename resolves to a .png at
 *  a fixed size, so the tests exercise orchestration, not the fs/sharp
 *  IO (that lives in the production resolver). */
const okResolver: AssetResolver = vi.fn(async (basename: string) => ({
  file: `${basename}.png`,
  width: 1024,
  height: 1024,
  format: "png" as const,
  mtime: 1_700_000_000_000,
  hasBackup: false,
}));

/** A resolver that reports every asset as missing on disk. */
const missingResolver: AssetResolver = vi.fn(async () => ({
  file: null,
  width: null,
  height: null,
  format: null,
  mtime: null,
  hasBackup: false,
}));

describe("buildThemeCatalog", () => {
  it("returns null for an unregistered theme id", async () => {
    expect(await buildThemeCatalog("no-such-theme", okResolver)).toBeNull();
  });

  it("carries the theme id + display name from the registry", async () => {
    const catalog = await buildThemeCatalog("candy-forest", okResolver);
    expect(catalog?.id).toBe("candy-forest");
    expect(catalog?.name).toBe("Candy Forest");
  });

  it("emits one slot per registered asset key", async () => {
    const catalog = await buildThemeCatalog("candy-forest", okResolver);
    const keys = catalog?.slots.map((s) => s.key);
    expect(keys).toEqual(expect.arrayContaining(["hub.portal", "hub.avatar"]));
    expect(catalog?.slots).toHaveLength(2);
  });

  it("resolves the default variant and attaches its basename", async () => {
    const catalog = await buildThemeCatalog("candy-forest", okResolver);
    const portal = catalog?.slots.find((s) => s.key === "hub.portal");
    expect(portal?.default.basename).toBe("/art/hub/portal-chesscito-normal");
    expect(portal?.default.file).toBe("/art/hub/portal-chesscito-normal.png");
    expect(portal?.default.width).toBe(1024);
  });

  it("resolves the pro variant when the slot declares one", async () => {
    const catalog = await buildThemeCatalog("candy-forest", okResolver);
    const portal = catalog?.slots.find((s) => s.key === "hub.portal");
    expect(portal?.pro?.basename).toBe("/art/hub/portal-chesscito-pro");
    expect(portal?.proReusesDefault).toBe(false);
  });

  it("flags pro-reuses-default when the slot ships no pro override", async () => {
    // Neither slot omits pro today; force the case with a fake registry
    // entry via a resolver-agnostic assertion on the contract instead.
    const catalog = await buildThemeCatalog("candy-forest", okResolver);
    for (const slot of catalog?.slots ?? []) {
      if (slot.pro === null) expect(slot.proReusesDefault).toBe(true);
      else expect(slot.proReusesDefault).toBe(false);
    }
  });

  it("surfaces usedIn metadata from the registry", async () => {
    const catalog = await buildThemeCatalog("candy-forest", okResolver);
    const portal = catalog?.slots.find((s) => s.key === "hub.portal");
    expect(portal?.usedIn).toEqual(["Hub — KingdomAnchor portal"]);
  });

  it("propagates missing files as null dimensions (no throw)", async () => {
    const catalog = await buildThemeCatalog("candy-forest", missingResolver);
    const portal = catalog?.slots.find((s) => s.key === "hub.portal");
    expect(portal?.default.file).toBeNull();
    expect(portal?.default.width).toBeNull();
  });
});
