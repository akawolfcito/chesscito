import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

import { AboutMethodology } from "../about-methodology";
import { ABOUT_METHODOLOGY_COPY } from "@/lib/content/editorial";

// AboutMethodology is now an async server component (Stage C i18n
// migration). Each test awaits the JSX result before rendering.
// `getTranslations` is stubbed globally in vitest.setup.ts so values
// resolve to the EN bundle, matching the editorial constants below.

describe("AboutMethodology", () => {
  it("renders the section title from editorial", async () => {
    const tree = await AboutMethodology();
    render(tree);
    expect(screen.getByText(ABOUT_METHODOLOGY_COPY.sectionTitle)).toBeInTheDocument();
  });

  it("renders the body paragraph with the full editorial text", async () => {
    const tree = await AboutMethodology();
    render(tree);
    expect(screen.getByText(ABOUT_METHODOLOGY_COPY.body)).toBeInTheDocument();
  });

  it("includes the FIDE Master attribution at least once on the section", async () => {
    const tree = await AboutMethodology();
    render(tree);
    expect(screen.getAllByText(/FIDE Master/i).length).toBeGreaterThanOrEqual(1);
  });

  it("renders both attribution chips (César + Wolfcito)", async () => {
    const tree = await AboutMethodology();
    render(tree);
    expect(screen.getByText(ABOUT_METHODOLOGY_COPY.cesar)).toBeInTheDocument();
    expect(screen.getByText(ABOUT_METHODOLOGY_COPY.wolfcito)).toBeInTheDocument();
  });

  it("exposes a labelled region so screen-readers anchor to the section", async () => {
    const tree = await AboutMethodology();
    render(tree);
    const region = screen.getByRole("region", { name: ABOUT_METHODOLOGY_COPY.sectionTitle });
    expect(region).toBeInTheDocument();
  });

  it("never makes medical claims — the body says nothing about prevention/cure/treatment", () => {
    expect(ABOUT_METHODOLOGY_COPY.body).not.toMatch(/prevent|cure|treat|alzheimer|dementia/i);
  });
});
