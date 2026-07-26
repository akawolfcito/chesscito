import { describe, it, expect, vi } from "vitest";
import { buildThemeCatalog, type AssetResolver } from "../catalog";
import { THEMES } from "../theme-registry";

/** A resolver stub that pretends every basename resolves to a .png at
 *  a fixed size, so the tests exercise orchestration, not the fs/sharp
 *  IO (that lives in the production resolver). */
const okResolver: AssetResolver = vi.fn(async (basename: string) => ({
  file: `${basename}.png`,
  width: 1024,
  height: 1024,
  format: "png" as const,
  mtime: 1_700_000_000_000,
  bytes: 4096,
  hasBackup: false,
}));

/** A resolver that reports every asset as missing on disk. */
const missingResolver: AssetResolver = vi.fn(async () => ({
  file: null,
  width: null,
  height: null,
  format: null,
  mtime: null,
  bytes: null,
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
    // Derived from the registry so registering new slots never breaks this.
    const registered = Object.keys(THEMES["candy-forest"].assets);
    expect(catalog?.slots).toHaveLength(registered.length);
  });

  it("resolves the default variant and attaches its basename", async () => {
    const catalog = await buildThemeCatalog("candy-forest", okResolver);
    const portal = catalog?.slots.find((s) => s.key === "hub.portal");
    expect(portal?.default?.basename).toBe("/art/hub/portal-chesscito-normal");
    expect(portal?.default?.file).toBe("/art/hub/portal-chesscito-normal.png");
    expect(portal?.default?.width).toBe(1024);
  });

  it("resolves the pro variant when the slot declares one", async () => {
    const catalog = await buildThemeCatalog("candy-forest", okResolver);
    const portal = catalog?.slots.find((s) => s.key === "hub.portal");
    expect(portal?.pro?.basename).toBe("/art/hub/portal-chesscito-pro");
    expect(portal?.proReusesDefault).toBe(false);
  });

  it("passes slot and variant context to responsive-family resolution", async () => {
    const resolver = vi.fn(okResolver);
    await buildThemeCatalog("candy-forest", resolver);
    expect(resolver).toHaveBeenCalledWith(
      "/art/avatar-lite-hub",
      { key: "hub.avatar-lite", variant: "default", root: "web" },
    );
    expect(resolver).toHaveBeenCalledWith(
      "/art/avatar-pro",
      { key: "hub.avatar-lite", variant: "pro", root: "web" },
    );
  });

  it("resolves every slot's owning app, defaulting to web", async () => {
    const catalog = await buildThemeCatalog("candy-forest", okResolver);
    const slots = new Map(catalog?.slots.map((slot) => [slot.key, slot]));

    // Slots that predate multi-root support declare no root at all.
    expect(THEMES["candy-forest"].assets["hub.portal"].root).toBeUndefined();
    expect(slots.get("hub.portal")?.root).toBe("web");
    // The carousel art lives in apps/landing/public, not apps/web/public.
    expect(slots.get("landing.slide1-avatar")?.root).toBe("landing");
  });

  it("tells the resolver which app root to probe", async () => {
    const resolver = vi.fn(okResolver);
    await buildThemeCatalog("candy-forest", resolver);
    expect(resolver).toHaveBeenCalledWith(
      "/art/landing-slides/avatar-chesscito-welcome",
      { key: "landing.slide1-avatar", variant: "default", root: "landing" },
    );
  });

  it("flags pro-reuses-default when the slot ships no pro override", async () => {
    // Neither slot omits pro today; force the case with a fake registry
    // entry via a resolver-agnostic assertion on the contract instead.
    const catalog = await buildThemeCatalog("candy-forest", okResolver);
    for (const slot of catalog?.slots ?? []) {
      expect(slot.proReusesDefault).toBe(slot.proMode === "inherit");
    }
  });

  it("surfaces usedIn metadata from the registry", async () => {
    const catalog = await buildThemeCatalog("candy-forest", okResolver);
    const portal = catalog?.slots.find((s) => s.key === "hub.portal");
    // Human label stays first; precise consumer locators (↳ …) are appended.
    expect(portal?.usedIn[0]).toBe("Hub — KingdomAnchor portal");
    expect(portal?.usedIn.some((u) => u.startsWith("↳ "))).toBe(true);
  });

  it("exposes the evidence-backed surface classification to the builder", async () => {
    const catalog = await buildThemeCatalog("candy-forest", okResolver);
    const slots = new Map(catalog?.slots.map((slot) => [slot.key, slot]));

    expect(slots.get("hub.avatar-lite")?.surface).toBe("shared");
    expect(slots.get("hub.portal")?.surface).toBe("full-legacy");
    expect(slots.get("hub.21-day-icon")?.surface).toBe("learn");
    expect(slots.get("hub.focus-passport-calendar")?.surface).toBe("learn");
    expect(slots.get("arena.bg-matchup")?.surface).toBe("play");
    expect(slots.get("hub.principal-button")?.surface).toBe("unknown");
    expect(slots.get("landing.hero")?.surface).toBe("landing");
    expect(slots.get("board.legacy-bg")?.surface).toBe("shared");
  });

  it("distinguishes the three visible training surfaces", async () => {
    const catalog = await buildThemeCatalog("candy-forest", okResolver);
    const slots = new Map(catalog?.slots.map((slot) => [slot.key, slot.usedIn]));

    expect(slots.get("hub.training")).toEqual(
      expect.arrayContaining([
        expect.stringContaining("Coach/Journal"),
        "↳ app/[locale]/coach/history/page.tsx",
      ]),
    );
    expect(slots.get("hub.train-pieces")).toEqual(
      expect.arrayContaining([
        expect.stringContaining("START FOCUS"),
        expect.stringContaining("Training side of mode selector"),
      ]),
    );
    expect(slots.get("hub.training-icon")).toEqual(
      expect.arrayContaining([
        expect.stringContaining("Focus Passport Special Training benefit"),
        "↳ components/hub/challenge-card.tsx",
        expect.stringContaining("Special Training/Mate tile"),
        "↳ components/hub/hub-arena-tile.tsx",
      ]),
    );
  });

  it("exposes independent Calendar and canonical Shield evidence for the Challenge Card", async () => {
    const catalog = await buildThemeCatalog("candy-forest", okResolver);
    const slots = new Map(catalog?.slots.map((slot) => [slot.key, slot]));

    expect(slots.get("hub.focus-passport-calendar")?.default?.basename).toBe(
      "/art/hub-icns/calendar-icon",
    );
    expect(slots.get("hub.focus-passport-calendar")?.usedIn).toEqual(
      expect.arrayContaining(["↳ components/hub/challenge-card.tsx"]),
    );
    expect(slots.get("shared.shield")?.usedIn).toEqual(
      expect.arrayContaining([
        expect.stringContaining("Focus Passport Shield benefit"),
        "↳ components/hub/challenge-card.tsx",
      ]),
    );
  });

  it("propagates missing files as null dimensions (no throw)", async () => {
    const catalog = await buildThemeCatalog("candy-forest", missingResolver);
    const portal = catalog?.slots.find((s) => s.key === "hub.portal");
    expect(portal?.default?.file).toBeNull();
    expect(portal?.default?.width).toBeNull();
  });
});

describe("single-file and derived slots", () => {
  // The slot-specific cases live in single-file-slots.test.ts — they name keys
  // that only exist once the slots are registered, and a string literal that
  // is not in ThemeAssetKey is a compile error, not just a failing assertion.

  it("leaves format null for a normal triplet slot", async () => {
    const catalog = await buildThemeCatalog("candy-forest", okResolver);
    const portal = catalog?.slots.find((s) => s.key === "hub.portal");
    expect(portal?.format).toBeNull();
  });

  it("leaves derivedFrom null for a normal editable slot", async () => {
    const catalog = await buildThemeCatalog("candy-forest", okResolver);
    const portal = catalog?.slots.find((s) => s.key === "hub.portal");
    expect(portal?.derivedFrom).toBeNull();
  });

  it("omits format from the resolver context for a triplet slot", async () => {
    const seen: { basename: string; format?: string }[] = [];
    const spy: AssetResolver = async (basename, context) => {
      seen.push({ basename, format: context?.format });
      return {
        file: `${basename}.png`,
        width: 1024,
        height: 1024,
        format: "png" as const,
        mtime: 1,
        bytes: 2048,
        hasBackup: false,
      };
    };
    await buildThemeCatalog("candy-forest", spy);
    const portal = seen.find((s) => s.basename === "/art/hub/portal-chesscito-normal");
    expect(portal?.format).toBeUndefined();
  });
});
