import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

import { KingdomAnchor } from "../kingdom-anchor";
import { HOME_ANCHOR_COPY } from "@/lib/content/editorial";

describe("KingdomAnchor", () => {
  it("renders the kingdom hero asset via <picture> with AVIF/WebP/PNG fallback chain", () => {
    const { container } = render(<KingdomAnchor />);
    const sources = container.querySelectorAll("source");
    expect(sources).toHaveLength(2);
    expect(sources[0]).toHaveAttribute(
      "srcset",
      "/art/redesign/bg/splash-loading.avif",
    );
    expect(sources[0]).toHaveAttribute("type", "image/avif");
    expect(sources[1]).toHaveAttribute(
      "srcset",
      "/art/redesign/bg/splash-loading.webp",
    );
    expect(sources[1]).toHaveAttribute("type", "image/webp");

    const img = container.querySelector("img");
    expect(img).toHaveAttribute("src", "/art/redesign/bg/splash-loading.png");
  });

  it("defaults to the playhub variant with aspect-ratio 1 / 1", () => {
    render(<KingdomAnchor />);
    const node = screen.getByRole("img", { name: HOME_ANCHOR_COPY.alt });
    expect(node).toHaveStyle({ aspectRatio: "1 / 1" });
    expect(node.className).toMatch(/kingdom-anchor--playhub/);
  });

  it("renders the arena-preview variant at aspect-ratio 1.3 / 1", () => {
    render(<KingdomAnchor variant="arena-preview" />);
    const node = screen.getByRole("img", { name: HOME_ANCHOR_COPY.alt });
    expect(node).toHaveStyle({ aspectRatio: "1.3 / 1" });
    expect(node.className).toMatch(/kingdom-anchor--arena-preview/);
  });

  it("renders the landing-hero variant at aspect-ratio 1.5 / 1", () => {
    render(<KingdomAnchor variant="landing-hero" />);
    const node = screen.getByRole("img", { name: HOME_ANCHOR_COPY.alt });
    expect(node).toHaveStyle({ aspectRatio: "1.5 / 1" });
    expect(node.className).toMatch(/kingdom-anchor--landing-hero/);
  });

  it("exposes role='img' and the aria-label sourced from HOME_ANCHOR_COPY.alt", () => {
    render(<KingdomAnchor />);
    const node = screen.getByRole("img", { name: HOME_ANCHOR_COPY.alt });
    expect(node).toBeInTheDocument();
    expect(node.tagName.toLowerCase()).not.toBe("img");
  });

  it("hides the inner <img> from assistive tech to avoid double-announcement", () => {
    const { container } = render(<KingdomAnchor />);
    const img = container.querySelector("img");
    expect(img).toHaveAttribute("aria-hidden", "true");
    expect(img).toHaveAttribute("alt", "");
  });

  it("merges a custom className alongside the base classes on the wrapper", () => {
    render(<KingdomAnchor className="custom-extra-class" />);
    const node = screen.getByRole("img", { name: HOME_ANCHOR_COPY.alt });
    expect(node.className).toMatch(/kingdom-anchor\b/);
    expect(node.className).toMatch(/custom-extra-class/);
  });
});
