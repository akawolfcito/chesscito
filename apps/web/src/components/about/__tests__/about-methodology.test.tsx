import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

import { AboutMethodology } from "../about-methodology";
import { ABOUT_METHODOLOGY_COPY } from "@/lib/content/editorial";

describe("AboutMethodology", () => {
  it("renders the section title from editorial", () => {
    render(<AboutMethodology />);
    expect(screen.getByText(ABOUT_METHODOLOGY_COPY.sectionTitle)).toBeInTheDocument();
  });

  it("renders the body paragraph with the full editorial text", () => {
    render(<AboutMethodology />);
    expect(screen.getByText(ABOUT_METHODOLOGY_COPY.body)).toBeInTheDocument();
  });

  it("includes the FIDE Master attribution at least once on the section", () => {
    render(<AboutMethodology />);
    // Appears in both the body paragraph and the César chip — assert
    // it shows up at least once. The body text is the canonical source
    // and is asserted in full above; this keeps the contract robust to
    // chip wording iteration.
    expect(screen.getAllByText(/FIDE Master/i).length).toBeGreaterThanOrEqual(1);
  });

  it("renders both attribution chips (César + Wolfcito)", () => {
    render(<AboutMethodology />);
    expect(screen.getByText(ABOUT_METHODOLOGY_COPY.cesar)).toBeInTheDocument();
    expect(screen.getByText(ABOUT_METHODOLOGY_COPY.wolfcito)).toBeInTheDocument();
  });

  it("exposes a labelled region so screen-readers anchor to the section", () => {
    render(<AboutMethodology />);
    const region = screen.getByRole("region", { name: ABOUT_METHODOLOGY_COPY.sectionTitle });
    expect(region).toBeInTheDocument();
  });

  it("never makes medical claims — the body says nothing about prevention/cure/treatment", () => {
    expect(ABOUT_METHODOLOGY_COPY.body).not.toMatch(/prevent|cure|treat|alzheimer|dementia/i);
  });
});
