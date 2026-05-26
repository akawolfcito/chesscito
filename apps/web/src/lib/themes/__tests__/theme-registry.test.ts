import { describe, it, expect } from "vitest";
import {
  DEFAULT_THEME_ID,
  THEMES,
  type ThemeAssetKey,
} from "../theme-registry";

const REQUIRED_ASSET_KEYS: readonly ThemeAssetKey[] = ["hub.portal"];

describe("theme-registry", () => {
  it("publishes candy-forest as the default theme id", () => {
    expect(DEFAULT_THEME_ID).toBe("candy-forest");
  });

  it("registers candy-forest with the documented metadata", () => {
    const theme = THEMES["candy-forest"];
    expect(theme).toBeDefined();
    expect(theme.id).toBe("candy-forest");
    expect(theme.name).toBe("Candy Forest");
  });

  it("every registered theme provides every required asset key", () => {
    for (const [id, theme] of Object.entries(THEMES)) {
      for (const key of REQUIRED_ASSET_KEYS) {
        const entry = theme.assets[key];
        expect(entry, `theme=${id} key=${key}`).toBeDefined();
        expect(entry.default, `theme=${id} key=${key}.default`).toMatch(/^\//);
      }
    }
  });

  it("candy-forest exposes both default + pro variants for hub.portal", () => {
    const entry = THEMES["candy-forest"].assets["hub.portal"];
    expect(entry.default).toBe(
      "/art/new-assets-chesscito/hub/chesscito-normal-portal",
    );
    expect(entry.pro).toBe(
      "/art/new-assets-chesscito/hub/chesscito-pro-portal",
    );
  });

  it("the default theme id resolves to a registered theme", () => {
    expect(THEMES[DEFAULT_THEME_ID]).toBeDefined();
  });
});
