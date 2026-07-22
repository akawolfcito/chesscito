import { describe, it, expect, vi } from "vitest";
import { buildThemeCatalog, type AssetResolver } from "../catalog";

/** Same stub shape the catalog tests use — orchestration, not fs/sharp IO. */
const okResolver: AssetResolver = vi.fn(async (basename: string) => ({
  file: `${basename}.png`,
  width: 1024,
  height: 1024,
  format: "png" as const,
  mtime: 1_700_000_000_000,
  hasBackup: false,
}));

describe("the three brand/social slots", () => {
  it("reports the declared format for a single-file slot", async () => {
    const catalog = await buildThemeCatalog("candy-forest", okResolver);
    const og = catalog?.slots.find((s) => s.key === "landing.og-image");
    expect(og?.format).toBe("jpg");
  });

  it("passes the format down to the resolver so it probes one extension", async () => {
    const seen: { basename: string; format?: string }[] = [];
    const spy: AssetResolver = async (basename, context) => {
      seen.push({ basename, format: context?.format });
      return {
        file: `${basename}.jpg`,
        width: 1200,
        height: 630,
        format: "jpg" as const,
        mtime: 1,
        hasBackup: false,
      };
    };
    await buildThemeCatalog("candy-forest", spy);
    const og = seen.find((s) => s.basename === "/og/chesscito-landing");
    expect(og?.format).toBe("jpg");
  });

  it("marks both icon slots as derived from the wolf master", async () => {
    const catalog = await buildThemeCatalog("candy-forest", okResolver);
    const favicon = catalog?.slots.find((s) => s.key === "brand.favicon-ico");
    expect(favicon?.derivedFrom).toBe("brand.favicon");
    const apple = catalog?.slots.find((s) => s.key === "brand.apple-icon");
    expect(apple?.derivedFrom).toBe("brand.favicon");
  });

  it("leaves derivedFrom null for the independently editable OG card", async () => {
    const catalog = await buildThemeCatalog("candy-forest", okResolver);
    const og = catalog?.slots.find((s) => s.key === "landing.og-image");
    expect(og?.derivedFrom).toBeNull();
  });

  it("owns all three files in apps/landing, not apps/web", async () => {
    const catalog = await buildThemeCatalog("candy-forest", okResolver);
    for (const key of ["landing.og-image", "brand.apple-icon", "brand.favicon-ico"] as const) {
      expect(catalog?.slots.find((s) => s.key === key)?.root).toBe("landing");
    }
  });

  it("points the derived icons at what the landing layout actually reads", async () => {
    const catalog = await buildThemeCatalog("candy-forest", okResolver);
    const slots = new Map(catalog?.slots.map((s) => [s.key, s]));
    // These basenames are the metadata paths in apps/landing/src/app/layout.tsx.
    expect(slots.get("brand.favicon-ico")?.default?.basename).toBe("/favicon");
    expect(slots.get("brand.apple-icon")?.default?.basename).toBe("/apple-icon");
    expect(slots.get("landing.og-image")?.default?.basename).toBe("/og/chesscito-landing");
  });
});
