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

  it("renders board-ch.{avif,webp,png} sources in the arena-preview variant", () => {
    const { container } = render(<KingdomAnchor variant="arena-preview" />);
    const boardPicture = container.querySelector(
      ".kingdom-anchor-board-inner > .kingdom-anchor-picture",
    );
    expect(boardPicture).not.toBeNull();
    const boardSources = boardPicture!.querySelectorAll("source");
    expect(boardSources).toHaveLength(2);
    expect(boardSources[0]).toHaveAttribute(
      "srcset",
      "/art/redesign/board/board-ch.avif",
    );
    expect(boardSources[0]).toHaveAttribute("type", "image/avif");
    expect(boardSources[1]).toHaveAttribute(
      "srcset",
      "/art/redesign/board/board-ch.webp",
    );
    expect(boardSources[1]).toHaveAttribute("type", "image/webp");
    const boardImg = container.querySelector(".kingdom-anchor-img");
    expect(boardImg).toHaveAttribute("src", "/art/redesign/board/board-ch.png");
  });

  it("does NOT render the splash-loading hero asset in the arena-preview variant", () => {
    const { container } = render(<KingdomAnchor variant="arena-preview" />);
    const sources = container.querySelectorAll("source");
    sources.forEach((s) => {
      expect(s.getAttribute("srcset")).not.toContain("splash-loading");
    });
  });

  it("emits AVIF/WebP/PNG fallback for each piece image in the overlay", () => {
    const { container } = render(<KingdomAnchor variant="arena-preview" />);
    const pieceItems = container.querySelectorAll(".kingdom-anchor-board-piece");
    expect(pieceItems.length).toBeGreaterThan(0);
    const sample = pieceItems[0].querySelector("picture");
    expect(sample).not.toBeNull();
    const sampleSources = sample!.querySelectorAll("source");
    expect(sampleSources).toHaveLength(2);
    expect(sampleSources[0].getAttribute("type")).toBe("image/avif");
    expect(sampleSources[0].getAttribute("srcset")).toMatch(/\.avif$/);
    expect(sampleSources[1].getAttribute("type")).toBe("image/webp");
    expect(sampleSources[1].getAttribute("srcset")).toMatch(/\.webp$/);
  });

  it("overlays the 32-piece starting position from /art/redesign/pieces/ in the arena-preview variant", () => {
    const { container } = render(<KingdomAnchor variant="arena-preview" />);
    const pieceItems = container.querySelectorAll(".kingdom-anchor-board-piece");
    expect(pieceItems).toHaveLength(32);
    const firstPieceImg = pieceItems[0].querySelector("img");
    expect(firstPieceImg?.getAttribute("src")).toMatch(
      /^\/art\/redesign\/pieces\/[wb]-(rook|knight|bishop|queen|king|pawn)\.png$/,
    );
  });

  it("renders both colors and all 6 piece types in the arena-preview overlay", () => {
    const { container } = render(<KingdomAnchor variant="arena-preview" />);
    const srcs = Array.from(
      container.querySelectorAll(".kingdom-anchor-board-piece img"),
    ).map((img) => img.getAttribute("src") ?? "");
    expect(srcs.some((s) => s.includes("/w-king.png"))).toBe(true);
    expect(srcs.some((s) => s.includes("/b-king.png"))).toBe(true);
    expect(srcs.filter((s) => s.includes("-pawn.png"))).toHaveLength(16);
    expect(srcs.filter((s) => s.includes("-rook.png"))).toHaveLength(4);
  });

  it("hides the arena-preview piece overlay from assistive tech", () => {
    const { container } = render(<KingdomAnchor variant="arena-preview" />);
    const overlay = container.querySelector(".kingdom-anchor-board-pieces");
    expect(overlay).toHaveAttribute("aria-hidden", "true");
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

  it("applies the adventure atmosphere by default", () => {
    render(<KingdomAnchor />);
    const node = screen.getByRole("img", { name: HOME_ANCHOR_COPY.alt });
    expect(node.className).toMatch(/is-atmosphere-adventure\b/);
    expect(node.className).not.toMatch(/is-atmosphere-scholarly\b/);
  });

  it("applies the scholarly atmosphere when atmosphere='scholarly'", () => {
    render(<KingdomAnchor atmosphere="scholarly" />);
    const node = screen.getByRole("img", { name: HOME_ANCHOR_COPY.alt });
    expect(node.className).toMatch(/is-atmosphere-scholarly\b/);
    expect(node.className).not.toMatch(/is-atmosphere-adventure\b/);
  });
});
