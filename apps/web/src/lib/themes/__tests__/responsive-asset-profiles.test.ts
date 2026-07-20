import { describe, expect, it } from "vitest";

import {
  getResponsiveAssetProfile,
  responsiveDerivativeHeight,
} from "../responsive-asset-profiles";
import { resolveAssetPath } from "../asset-variant";
import { THEMES, THEME_SLOT_SURFACES } from "../theme-registry";

describe("responsive asset profiles", () => {
  it("detects the three responsive slots and leaves ordinary slots alone", () => {
    expect(getResponsiveAssetProfile("hub.avatar-lite")?.widths).toEqual([224, 340]);
    expect(getResponsiveAssetProfile("brand.title")?.widths).toEqual([288, 384]);
    expect(getResponsiveAssetProfile("shared.welcome-gift")?.widths).toEqual([
      96,
      128,
      160,
    ]);
    expect(getResponsiveAssetProfile("hub.portal")).toBeNull();
  });

  it("derives the exact 224w/340w avatar dimensions without changing ratio", () => {
    const profile = getResponsiveAssetProfile("hub.avatar-lite");
    expect(profile).not.toBeNull();
    expect(responsiveDerivativeHeight(profile!, 224)).toBe(251);
    expect(responsiveDerivativeHeight(profile!, 340)).toBe(382);
  });

  it("does not change registry paths, variants, or slot classification", () => {
    const assets = THEMES["candy-forest"].assets;
    expect(resolveAssetPath(assets["hub.avatar-lite"], "default")).toBe(
      "/art/avatar-lite-hub",
    );
    expect(resolveAssetPath(assets["hub.avatar-lite"], "pro")).toBe(
      "/art/avatar-pro",
    );
    expect(resolveAssetPath(assets["brand.title"], "pro")).toBe(
      "/art/title-chesscito",
    );
    expect(resolveAssetPath(assets["shared.welcome-gift"], "pro")).toBe(
      "/art/shop/welcome-gift",
    );
    expect(THEME_SLOT_SURFACES["hub.avatar-lite"]).toBe("shared");
    expect(THEME_SLOT_SURFACES["brand.title"]).toBe("shared");
    expect(THEME_SLOT_SURFACES["shared.welcome-gift"]).toBe("shared");
  });
});
