import { afterEach, describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";

import { ThemeAssetPicture } from "@/components/themes/theme-asset-picture";
import {
  ThemeCssVariables,
  themeCssVariable,
} from "@/components/themes/theme-css-variables";
import { pieceThemeSlot } from "../piece-theme-assets";
import { ThemeVariantOverride } from "../theme-variant-provider";
import { THEMES, type ThemeAssetEntry } from "../theme-registry";
import { themeImageSet } from "../use-theme-background";

const assets = THEMES["candy-forest"].assets;
const originals = new Map<string, ThemeAssetEntry>();

function setEntry(key: keyof typeof assets, entry: ThemeAssetEntry) {
  if (!originals.has(key)) originals.set(key, assets[key]);
  assets[key] = entry;
}

afterEach(() => {
  for (const [key, entry] of originals) {
    assets[key as keyof typeof assets] = entry;
  }
  originals.clear();
});

describe("ThemeAssetPicture", () => {
  it("renders DEFAULT asset, PRO inherit, and PRO explicit asset", () => {
    setEntry("hub.training", {
      default: "/art/default-training",
      pro: { mode: "inherit" },
    });
    const view = render(
      <ThemeVariantOverride variant="default">
        <ThemeAssetPicture slot="hub.training" alt="Training" />
      </ThemeVariantOverride>,
    );
    expect(view.getByRole("img")).toHaveAttribute("src", "/art/default-training.png");

    view.rerender(
      <ThemeVariantOverride variant="pro">
        <ThemeAssetPicture slot="hub.training" alt="Training" />
      </ThemeVariantOverride>,
    );
    expect(view.getByRole("img")).toHaveAttribute("src", "/art/default-training.png");

    setEntry("hub.training", {
      default: "/art/default-training",
      pro: "/art/theme-builder/candy-forest/hub/training/pro",
    });
    view.rerender(
      <ThemeVariantOverride variant="pro">
        <ThemeAssetPicture slot="hub.training" alt="Training" />
      </ThemeVariantOverride>,
    );
    expect(view.getByRole("img")).toHaveAttribute(
      "src",
      "/art/theme-builder/candy-forest/hub/training/pro.png",
    );
  });

  it("omits the complete image tree for DEFAULT none and PRO none", () => {
    setEntry("hub.training", {
      default: { mode: "none" },
      pro: "/art/pro-training",
    });
    const view = render(
      <ThemeVariantOverride variant="default">
        <ThemeAssetPicture slot="hub.training" alt="Training" />
      </ThemeVariantOverride>,
    );
    expect(view.container.querySelector("picture")).toBeNull();

    setEntry("hub.training", {
      default: "/art/default-training",
      pro: { mode: "none" },
    });
    view.rerender(
      <ThemeVariantOverride variant="pro">
        <ThemeAssetPicture slot="hub.training" alt="Training" />
      </ThemeVariantOverride>,
    );
    expect(view.container.querySelector("picture")).toBeNull();
    expect(view.container.querySelector('img[src=""]')).toBeNull();
    expect(view.container.querySelector('source[srcset=""]')).toBeNull();
  });

  it("resolves a composed piece family through its catalog slot", () => {
    setEntry("board.piece.black.knight", {
      default: "/art/default-knight",
      pro: "/art/pro-knight",
    });
    const view = render(
      <ThemeVariantOverride variant="pro">
        <ThemeAssetPicture slot={pieceThemeSlot("b", "knight")} alt="Knight" />
      </ThemeVariantOverride>,
    );
    expect(view.getByRole("img")).toHaveAttribute("src", "/art/pro-knight.png");
  });

  it("accepts an explicit variant for prop-controlled presenters", () => {
    setEntry("hub.pro-chip", {
      default: "/art/inactive-chip",
      pro: "/art/active-chip",
    });
    const view = render(
      <ThemeAssetPicture slot="hub.pro-chip" variant="pro" alt="PRO" />,
    );
    expect(view.getByRole("img")).toHaveAttribute("src", "/art/active-chip.png");
  });

  it("keeps responsive srcsets for deterministic Theme Builder paths", () => {
    setEntry("hub.avatar-lite", {
      default: "/art/avatar-default",
      pro: "/art/theme-builder/candy-forest/hub/avatar-lite/pro",
    });
    const view = render(
      <ThemeVariantOverride variant="pro">
        <ThemeAssetPicture
          slot="hub.avatar-lite"
          alt="Avatar"
          sizes="113px"
        />
      </ThemeVariantOverride>,
    );
    expect(view.container.querySelector('source[type="image/avif"]')).toHaveAttribute(
      "srcset",
      "/art/theme-builder/candy-forest/hub/avatar-lite/pro-224w.avif 224w, /art/theme-builder/candy-forest/hub/avatar-lite/pro-340w.avif 340w, /art/theme-builder/candy-forest/hub/avatar-lite/pro.avif 499w",
    );
    expect(view.container.querySelector('source[type="image/webp"]')).toHaveAttribute(
      "srcset",
      "/art/theme-builder/candy-forest/hub/avatar-lite/pro-224w.webp 224w, /art/theme-builder/candy-forest/hub/avatar-lite/pro-340w.webp 340w, /art/theme-builder/candy-forest/hub/avatar-lite/pro.webp 499w",
    );
    expect(view.getByRole("img")).toHaveAttribute("width", "499");
    expect(view.getByRole("img")).toHaveAttribute("height", "560");
  });
});

describe("theme CSS adapter", () => {
  it("emits image-set for assets and CSS none without url-empty fallbacks", () => {
    expect(themeImageSet("/art/background")).toContain('url("/art/background.avif")');
    expect(themeImageSet("")).toBe("none");

    setEntry("shared.panel-bg", {
      default: "/art/default-panel",
      pro: { mode: "none" },
    });
    const view = render(
      <ThemeVariantOverride variant="pro">
        <ThemeCssVariables />
      </ThemeVariantOverride>,
    );
    expect(view.container.textContent).toContain(
      `${themeCssVariable("shared.panel-bg")}:none`,
    );
    expect(view.container.textContent).not.toContain('url("")');
  });

  it("emits identical raw CSS syntax during server rendering", () => {
    const markup = renderToStaticMarkup(
      <ThemeVariantOverride variant="default">
        <ThemeCssVariables />
      </ThemeVariantOverride>,
    );
    expect(markup).toContain('url("/art/');
    expect(markup).not.toContain("&quot;");
  });
});
