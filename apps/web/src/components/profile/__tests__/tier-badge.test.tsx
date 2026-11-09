import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { TierBadge } from "@/components/profile/tier-badge";

describe("<TierBadge>", () => {
  it("renders tier title + xp value", () => {
    render(<TierBadge tier="knight" title="Knight" xp={247} />);
    expect(screen.getByText("Knight")).toBeInTheDocument();
    expect(screen.getByText("247")).toBeInTheDocument();
  });

  it("renders Visitor variant with 0 XP without crash", () => {
    render(<TierBadge tier="visitor" title="Visitor" xp={0} />);
    expect(screen.getByText("Visitor")).toBeInTheDocument();
    expect(screen.getByText("0")).toBeInTheDocument();
  });
});
