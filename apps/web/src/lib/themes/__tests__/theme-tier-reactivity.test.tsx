import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";

import { ThemeAssetPicture } from "@/components/themes/theme-asset-picture";

const entitlement = {
  status: "loading" as "loading" | "active" | "inactive" | "error",
  active: false,
  loading: true,
  expiresAt: null as number | null,
  stale: null as null | { source: "server"; active: boolean; expiresAt: number | null },
  error: null,
};

vi.mock("@/lib/pro/use-is-pro-active", () => ({
  useProEntitlement: () => entitlement,
}));
vi.mock("wagmi", () => ({
  useAccount: () => ({ address: "0x1234567890abcdef1234567890abcdef12345678" }),
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
  entitlement.status = "loading";
  entitlement.expiresAt = null;
  entitlement.stale = null;
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
    entitlement.status = "active";
    view.rerender(<Subject />);
    expect(view.getByRole("img")).toBe(image);
    expect(image).toHaveAttribute("src", "/art/pro-training.png");

    entitlement.active = false;
    entitlement.status = "inactive";
    view.rerender(<Subject />);
    expect(view.getByRole("img")).toBe(image);
    expect(image).toHaveAttribute("src", "/art/default-training.png");
  });

  it("keeps DEFAULT for PRO inherit and removes the element for PRO none", () => {
    entitlement.active = true;
    entitlement.loading = false;
    entitlement.status = "active";
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

  it("retains the last successful PRO tier through an error without authorization", () => {
    entitlement.active = true;
    entitlement.loading = false;
    entitlement.status = "active";
    const view = render(<Subject />);
    const image = view.getByRole("img");
    expect(image).toHaveAttribute("src", "/art/pro-training.png");

    entitlement.active = false;
    entitlement.status = "error";
    entitlement.stale = {
      source: "server",
      active: true,
      expiresAt: Date.now() + 86_400_000,
    };
    view.rerender(<Subject />);

    expect(entitlement.active).toBe(false);
    expect(image).toHaveAttribute("src", "/art/pro-training.png");

    entitlement.status = "inactive";
    entitlement.stale = null;
    view.rerender(<Subject />);
    expect(image).toHaveAttribute("src", "/art/default-training.png");
  });
});
