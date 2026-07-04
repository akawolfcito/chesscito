import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { CandyIcon } from "@/components/redesign/candy-icon";

describe("CandyIcon", () => {
  it("renders an accessible image when given a label", () => {
    render(<CandyIcon name="star" label="Star" />);
    expect(screen.getByAltText("Star")).toBeInTheDocument();
  });

  it("hides the image from the accessibility tree when decorative", () => {
    const { container } = render(<CandyIcon name="star" />);
    const img = container.querySelector("img");
    expect(img).toHaveAttribute("aria-hidden", "true");
    expect(img).toHaveAttribute("alt", "");
  });
});
