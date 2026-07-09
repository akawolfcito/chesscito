import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Pill } from "@/components/onboarding/pill";

describe("Pill", () => {
  /**
   * The label names the thing; the sublabel qualifies it. Until 2026-07-08 the
   * scale said the opposite (label 0.6rem, sublabel 0.7rem) and the dimming
   * landed on the larger of the two, so "21 focus days" outweighed "Focus
   * Passport". Slide 1 gained sublabels in the same change, which would have
   * tripled the defect.
   */
  it("renders the label larger than the sublabel, and dims only the sublabel", () => {
    render(<Pill icon={null} label="Focus Passport" sublabel="21 focus days" />);

    const label = screen.getByText("Focus Passport");
    const sublabel = screen.getByText("21 focus days");

    expect(label).toHaveClass("text-[0.7rem]");
    expect(sublabel).toHaveClass("text-[0.6rem]");
    expect(label.className).not.toContain("opacity-");
    expect(sublabel).toHaveClass("opacity-80");
  });

  it("omits the sublabel node entirely when no sublabel is given", () => {
    const { container } = render(<Pill icon={null} label="Saved games" />);
    expect(container.querySelectorAll("span.text-\\[0\\.6rem\\]")).toHaveLength(0);
  });
});
