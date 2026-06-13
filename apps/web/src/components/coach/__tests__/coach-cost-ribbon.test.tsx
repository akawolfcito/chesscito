import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { CoachCostRibbon } from "../coach-cost-ribbon";

describe("CoachCostRibbon", () => {
  it("renders the Peón cost (♟ 1) for free users", () => {
    const { container } = render(<CoachCostRibbon proActive={false} />);
    expect(screen.getByText("1")).toBeInTheDocument();
    // Peón sprite, not the crown.
    const img = container.querySelector("img");
    expect(img).toHaveAttribute("src", "/art/redesign/pieces/w-pawn.png");
    expect(container.querySelector(".coach-cost-ribbon--peon")).toBeTruthy();
    expect(container.querySelector(".coach-cost-ribbon--pro")).toBeNull();
  });

  it("renders the PRO crown ribbon for subscribers", () => {
    const { container } = render(<CoachCostRibbon proActive />);
    expect(screen.getByText("PRO")).toBeInTheDocument();
    // Crown sprite from the CandyIcon set.
    const img = container.querySelector("img");
    expect(img).toHaveAttribute("src", "/art/redesign/icons/crown.png");
    expect(container.querySelector(".coach-cost-ribbon--pro")).toBeTruthy();
  });

  it("is decorative (aria-hidden) — cost is conveyed via labels/hints", () => {
    const { container } = render(<CoachCostRibbon />);
    expect(
      container.querySelector(".coach-cost-ribbon"),
    ).toHaveAttribute("aria-hidden", "true");
  });

  it("applies the requested positioning variant", () => {
    const { container, rerender } = render(<CoachCostRibbon variant="cta" />);
    expect(container.querySelector(".coach-cost-ribbon--cta")).toBeTruthy();
    rerender(<CoachCostRibbon variant="tile" />);
    expect(container.querySelector(".coach-cost-ribbon--tile")).toBeTruthy();
  });

  it("defaults to the free Peón cta variant", () => {
    const { container } = render(<CoachCostRibbon />);
    expect(container.querySelector(".coach-cost-ribbon--cta")).toBeTruthy();
    expect(container.querySelector(".coach-cost-ribbon--peon")).toBeTruthy();
  });
});
