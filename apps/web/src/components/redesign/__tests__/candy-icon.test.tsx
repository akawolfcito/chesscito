import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { CandyIcon } from "../candy-icon";

describe("CandyIcon", () => {
  it("renders the AVIF/WebP/PNG source chain for the given sprite name", () => {
    const { container } = render(<CandyIcon name="star" />);
    const sources = container.querySelectorAll("source");
    expect(sources).toHaveLength(2);
    expect(sources[0]).toHaveAttribute("srcset", "/art/redesign/icons/star.avif");
    expect(sources[0]).toHaveAttribute("type", "image/avif");
    expect(sources[1]).toHaveAttribute("srcset", "/art/redesign/icons/star.webp");
    expect(sources[1]).toHaveAttribute("type", "image/webp");

    const img = container.querySelector("img");
    expect(img).toHaveAttribute("src", "/art/redesign/icons/star.png");
  });

  it("marks the image as decorative when no label is provided", () => {
    const { container } = render(<CandyIcon name="crown" />);
    const img = container.querySelector("img");
    expect(img).toHaveAttribute("aria-hidden", "true");
    expect(img).toHaveAttribute("alt", "");
  });

  it("exposes the label as accessible alt text when provided", () => {
    render(<CandyIcon name="trophy" label="Trophy earned" />);
    const img = screen.getByAltText("Trophy earned");
    expect(img).toBeInTheDocument();
    expect(img).not.toHaveAttribute("aria-hidden");
  });

  it("merges user className onto the <picture> wrapper", () => {
    const { container } = render(
      <CandyIcon name="shield" className="h-6 w-6 text-amber-400" />
    );
    const picture = container.querySelector("picture");
    expect(picture?.className).toContain("candy-icon");
    expect(picture?.className).toContain("inline-block");
    expect(picture?.className).toContain("h-6");
    expect(picture?.className).toContain("w-6");
  });
});
