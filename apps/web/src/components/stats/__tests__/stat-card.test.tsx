import { describe, it, expect, afterEach } from "vitest";
import { cleanup } from "@testing-library/react";
import { renderWithIntl as render, screen } from "@/test-utils/render-with-intl";

import { StatCard } from "../stat-card";

afterEach(() => {
  cleanup();
});

describe("StatCard", () => {
  it("renders primary variant by default with the headline label, value, sublabel", () => {
    render(
      <StatCard label="Victory NFTs Minted" value={1234} sublabel="Saved victories on Celo mainnet" />,
    );
    expect(screen.getByText("Victory NFTs Minted")).toBeInTheDocument();
    expect(screen.getByText("1,234")).toBeInTheDocument();
    expect(screen.getByText("Saved victories on Celo mainnet")).toBeInTheDocument();
  });

  it("formats the number with thousands separators", () => {
    render(<StatCard label="Total" value={1234567} />);
    expect(screen.getByText("1,234,567")).toBeInTheDocument();
  });

  it("renders an em-dash placeholder when value is null", () => {
    render(<StatCard label="Sessions" value={null} />);
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("primary variant uses the 2xl number style", () => {
    render(<StatCard label="Primary" value={42} variant="primary" />);
    const numberEl = screen.getByText("42");
    expect(numberEl.className).toContain("text-2xl");
  });

  it("secondary variant uses the smaller lg number style", () => {
    render(<StatCard label="Secondary" value={99} variant="secondary" />);
    const numberEl = screen.getByText("99");
    expect(numberEl.className).toContain("text-lg");
    expect(numberEl.className).not.toContain("text-2xl");
  });

  it("hero variant uses 3xl number on mobile and 4xl on desktop with tabular-nums", () => {
    render(<StatCard label="Hero" value={1234} variant="hero" />);
    const numberEl = screen.getByText("1,234");
    expect(numberEl.className).toContain("text-3xl");
    expect(numberEl.className).toContain("md:text-4xl");
    expect(numberEl.className).toContain("tabular-nums");
  });

  it("hero variant uses larger container padding (px-5 py-4) than primary (px-4 py-3)", () => {
    const { container: heroContainer } = render(
      <StatCard label="Hero" value={1} variant="hero" />,
    );
    const heroTile = heroContainer.querySelector(".paper-tray");
    expect(heroTile?.className).toContain("px-5");
    expect(heroTile?.className).toContain("py-4");
    cleanup();

    const { container: primaryContainer } = render(
      <StatCard label="Primary" value={1} variant="primary" />,
    );
    const primaryTile = primaryContainer.querySelector(".paper-tray");
    expect(primaryTile?.className).toContain("px-4");
    expect(primaryTile?.className).toContain("py-3");
  });

  it("hero variant renders the sublabel helper text", () => {
    render(
      <StatCard
        label="Hero"
        value={250}
        sublabel="Saved victories in the last 30 days"
        variant="hero"
      />,
    );
    expect(screen.getByText("Saved victories in the last 30 days")).toBeInTheDocument();
  });

  it("hero variant renders em-dash for null value (same defensive behavior as other variants)", () => {
    render(<StatCard label="Hero" value={null} variant="hero" />);
    expect(screen.getByText("—")).toBeInTheDocument();
  });
});
