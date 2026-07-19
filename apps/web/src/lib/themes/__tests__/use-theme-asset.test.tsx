import { describe, it, expect } from "vitest";
import { renderHook } from "@testing-library/react";

import { useThemeAsset } from "../use-theme-asset";
import { useActiveTheme } from "../use-active-theme";
import { useOwnedThemes } from "../use-owned-themes";
import { DEFAULT_THEME_ID, THEMES } from "../theme-registry";

describe("useActiveTheme", () => {
  it("returns the default theme id in v1", () => {
    const { result } = renderHook(() => useActiveTheme());
    expect(result.current).toBe(DEFAULT_THEME_ID);
  });
});

describe("useOwnedThemes", () => {
  it("includes the default theme for every wallet (no purchase required)", () => {
    const { result } = renderHook(() => useOwnedThemes());
    expect(result.current).toContain(DEFAULT_THEME_ID);
  });
});

describe("useThemeAsset", () => {
  it("returns the default variant basename for a known key", () => {
    const { result } = renderHook(() => useThemeAsset("hub.portal"));
    expect(result.current).toBe(
      THEMES["candy-forest"].assets["hub.portal"].default,
    );
  });

  it("returns the pro variant when explicitly requested + defined", () => {
    const { result } = renderHook(() => useThemeAsset("hub.portal", "pro"));
    expect(result.current).toBe(
      THEMES["candy-forest"].assets["hub.portal"].pro,
    );
  });

  it("falls back to default when the pro variant is missing for the slot", () => {
    // Mutate a clone to simulate a theme without pro variant. Reset
    // after the assertion so the registry stays clean for later tests.
    const original = THEMES["candy-forest"].assets["hub.portal"];
    THEMES["candy-forest"].assets["hub.portal"] = { default: original.default };
    try {
      const { result } = renderHook(() => useThemeAsset("hub.portal", "pro"));
      expect(result.current).toBe(original.default);
    } finally {
      THEMES["candy-forest"].assets["hub.portal"] = original;
    }
  });

  it("returns an empty path when PRO explicitly disables an inherited asset", () => {
    const original = THEMES["candy-forest"].assets["hub.portal"];
    THEMES["candy-forest"].assets["hub.portal"] = {
      default: "/art/x",
      pro: { mode: "none" },
    };
    try {
      const { result } = renderHook(() => useThemeAsset("hub.portal", "pro"));
      expect(result.current).toBe("");
    } finally {
      THEMES["candy-forest"].assets["hub.portal"] = original;
    }
  });

  it("resolves an explicit object-form asset", () => {
    const original = THEMES["candy-forest"].assets["hub.portal"];
    THEMES["candy-forest"].assets["hub.portal"] = {
      default: { mode: "asset", path: "/art/object-path" },
      pro: { mode: "inherit" },
    };
    try {
      const { result } = renderHook(() => useThemeAsset("hub.portal", "pro"));
      expect(result.current).toBe("/art/object-path");
    } finally {
      THEMES["candy-forest"].assets["hub.portal"] = original;
    }
  });
});
