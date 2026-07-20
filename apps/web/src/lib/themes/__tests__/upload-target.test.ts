import { describe, it, expect } from "vitest";
import {
  resolveUploadTarget,
  resolveVariantBasename,
} from "../upload-target";

describe("resolveUploadTarget", () => {
  it("rejects an unknown theme", () => {
    const r = resolveUploadTarget("no-such-theme", "hub.portal", "default");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/theme/i);
  });

  it("rejects an unknown slot key", () => {
    const r = resolveUploadTarget("candy-forest", "hub.nope", "default");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/slot/i);
  });

  it("rejects an invalid variant", () => {
    const r = resolveUploadTarget("candy-forest", "hub.portal", "ultra");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/variant/i);
  });

  it("resolves the default basename from the registry", () => {
    const r = resolveUploadTarget("candy-forest", "hub.portal", "default");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.basename).toBe("/art/hub/portal-chesscito-normal");
      expect(r.declaresAsset).toBe(true);
      expect(r.responsiveProfile).toBeNull();
    }
  });

  it("resolves the pro basename when the slot declares one", () => {
    const r = resolveUploadTarget("candy-forest", "hub.portal", "pro");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.basename).toBe("/art/hub/portal-chesscito-pro");
      expect(r.declaresAsset).toBe(true);
    }
  });

  it("never returns a basename outside /art", () => {
    const r = resolveUploadTarget("candy-forest", "hub.portal", "default");
    if (r.ok) expect(r.basename.startsWith("/art/")).toBe(true);
  });

  it("carries authoritative responsive metadata for every avatar variant", () => {
    for (const variant of ["default", "pro"] as const) {
      const r = resolveUploadTarget("candy-forest", "hub.avatar-lite", variant);
      expect(r.ok).toBe(true);
      if (r.ok) {
        expect(r.responsiveProfile).toEqual({
          widths: [224, 340],
          canonical: { width: 499, height: 560 },
        });
      }
    }
  });
});

describe("resolveVariantBasename", () => {
  it("returns the default basename for variant=default", () => {
    const r = resolveVariantBasename({ default: "/art/x" }, "default");
    expect(r).toEqual({
      ok: true,
      basename: "/art/x",
      declaresAsset: true,
      responsiveProfile: null,
    });
  });

  it("returns the pro basename when present", () => {
    const r = resolveVariantBasename({ default: "/art/x", pro: "/art/x-pro" }, "pro");
    expect(r).toEqual({
      ok: true,
      basename: "/art/x-pro",
      declaresAsset: true,
      responsiveProfile: null,
    });
  });

  it("derives a deterministic pro target when the slot inherits", () => {
    const r = resolveVariantBasename({ default: "/art/x" }, "pro", {
      themeId: "candy-forest",
      key: "hub.example",
    });
    expect(r).toEqual({
      ok: true,
      basename: "/art/theme-builder/candy-forest/hub/example/pro",
      declaresAsset: false,
      responsiveProfile: null,
    });
  });

  it("derives a deterministic default target when the slot has none", () => {
    const r = resolveVariantBasename({ pro: "/art/x-pro" }, "default", {
      themeId: "candy-forest",
      key: "arena.frame",
    });
    expect(r).toEqual({
      ok: true,
      basename: "/art/theme-builder/candy-forest/arena/frame/default",
      declaresAsset: false,
      responsiveProfile: null,
    });
  });

  it("refuses an invalid variant", () => {
    const r = resolveVariantBasename({ default: "/art/x" }, "ultra");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/variant/i);
  });
});
