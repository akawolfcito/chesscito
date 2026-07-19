import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";

import { ThemeAssetPicture } from "@/components/themes/theme-asset-picture";

const entitlement = {
  active: false,
  loading: true,
};

vi.mock("@/lib/pro/use-is-pro-active", () => ({
  useProEntitlement: () => entitlement,
}));

import { ThemeVariantProvider } from "../theme-variant-provider";
import { THEMES } from "../theme-registry";

const originalTraining = THEMES["candy-forest"].assets["hub.training"];

function Subject() {
  return (
    <ThemeVariantProvider>
      <ThemeAssetPicture slot="hub.training" alt="Training" />
    </ThemeVariantProvider>
  );
}

beforeEach(() => {
  entitlement.active = false;
  entitlement.loading = true;
  THEMES["candy-forest"].assets["hub.training"] = {
    default: "/art/default-training",
    pro: "/art/pro-training",
  };
});

afterEach(() => {
  THEMES["candy-forest"].assets["hub.training"] = originalTraining;
});

describe("effective theme tier", () => {
  it("reactively swaps DEFAULT to PRO and back without remounting the adapter", () => {
    const view = render(<Subject />);
    const image = view.getByRole("img");
    expect(image).toHaveAttribute("src", "/art/default-training.png");

    entitlement.active = true;
    entitlement.loading = false;
    view.rerender(<Subject />);
    expect(view.getByRole("img")).toBe(image);
    expect(image).toHaveAttribute("src", "/art/pro-training.png");

    entitlement.active = false;
    view.rerender(<Subject />);
    expect(view.getByRole("img")).toBe(image);
    expect(image).toHaveAttribute("src", "/art/default-training.png");
  });

  it("keeps DEFAULT for PRO inherit and removes the element for PRO none", () => {
    entitlement.active = true;
    entitlement.loading = false;
    THEMES["candy-forest"].assets["hub.training"] = {
      default: "/art/default-training",
      pro: { mode: "inherit" },
    };
    const view = render(<Subject />);
    expect(view.getByRole("img")).toHaveAttribute(
      "src",
      "/art/default-training.png",
    );

    THEMES["candy-forest"].assets["hub.training"] = {
      default: "/art/default-training",
      pro: { mode: "none" },
    };
    view.rerender(<Subject />);
    expect(view.container.querySelector("picture")).toBeNull();
    expect(view.container.querySelector('img[src=""]')).toBeNull();
    expect(view.container.querySelector('source[srcset=""]')).toBeNull();
  });
});
