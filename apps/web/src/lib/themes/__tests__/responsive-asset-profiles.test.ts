import { describe, expect, it } from "vitest";

import {
  getResponsiveAssetProfile,
  responsiveDerivativeHeight,
} from "../responsive-asset-profiles";
import { deterministicVariantPath, resolveAssetPath } from "../asset-variant";
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

  /**
   * This used to pin the literal paths ("/art/title-chesscito", …) under the
   * name "does not change registry paths". That guarantee was about a single
   * PR — proving the responsive profiles landed without disturbing the
   * registry — and it stopped being true the moment the theme-builder started
   * repointing slots, which is its job (b6a6e507 moved brand.title/pro to a
   * builder path and turned CI red for two days).
   *
   * The durable contract is not WHICH path a slot holds. It is that every
   * responsive slot resolves to SOME real asset in both variants — either a
   * hand-authored path or the builder's deterministic one — and that the slot
   * classification stays put. A slot that resolves to null is the actual bug:
   * a responsive profile pointing at nothing renders a broken <picture>.
   */
  it("keeps every responsive slot resolvable in both variants", () => {
    const assets = THEMES["candy-forest"].assets;
    const RESPONSIVE_SLOTS = [
      "hub.avatar-lite",
      "brand.title",
      "shared.welcome-gift",
    ] as const;

    for (const slot of RESPONSIVE_SLOTS) {
      expect(getResponsiveAssetProfile(slot), `${slot} lost its profile`).not.toBeNull();
      // Classification drives which surface may override the slot; a silent
      // move between surfaces changes who can edit it.
      expect(THEME_SLOT_SURFACES[slot], `${slot} changed surface`).toBe("shared");

      for (const variant of ["default", "pro"] as const) {
        const path = resolveAssetPath(assets[slot], variant);
        expect(path, `${slot}/${variant} resolves to nothing`).toBeTruthy();
        // Either the founder authored it by hand, or the builder wrote it at
        // its deterministic location. Anything else is a malformed entry.
        const authored = path!.startsWith("/art/");
        const fromBuilder =
          path === deterministicVariantPath("candy-forest", slot, variant);
        expect(
          authored || fromBuilder,
          `${slot}/${variant} has a malformed path: ${path}`,
        ).toBe(true);
      }
    }
  });
});
