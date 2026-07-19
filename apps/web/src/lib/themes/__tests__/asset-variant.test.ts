import { describe, expect, it } from "vitest";
import { resolveAssetPath, resolveAssetVariant } from "../asset-variant";

describe("asset variant resolution", () => {
  it("supports DEFAULT asset + PRO inherit", () => {
    const entry = { default: "/art/default", pro: { mode: "inherit" } as const };
    expect(resolveAssetPath(entry, "default")).toBe("/art/default");
    expect(resolveAssetPath(entry, "pro")).toBe("/art/default");
  });

  it("supports independent DEFAULT and PRO assets", () => {
    const entry = { default: "/art/default", pro: "/art/pro" };
    expect(resolveAssetPath(entry, "pro")).toBe("/art/pro");
  });

  it("supports DEFAULT none + PRO asset", () => {
    const entry = { default: { mode: "none" } as const, pro: "/art/pro" };
    expect(resolveAssetPath(entry, "default")).toBeNull();
    expect(resolveAssetPath(entry, "pro")).toBe("/art/pro");
  });

  it("supports DEFAULT asset + PRO none", () => {
    const entry = { default: "/art/default", pro: { mode: "none" } as const };
    expect(resolveAssetPath(entry, "default")).toBe("/art/default");
    expect(resolveAssetPath(entry, "pro")).toBeNull();
  });

  it("maps legacy omissions to DEFAULT none and PRO inherit", () => {
    expect(resolveAssetVariant({ pro: "/art/pro" }, "default")).toEqual({ mode: "none" });
    expect(resolveAssetVariant({ default: "/art/default" }, "pro")).toEqual({ mode: "inherit" });
  });
});
