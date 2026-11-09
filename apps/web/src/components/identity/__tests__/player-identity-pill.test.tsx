// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { PlayerIdentityPill } from "../player-identity-pill";

describe("PlayerIdentityPill", () => {
  it("shows the nickname, not a raw wallet, and labels itself for a11y", () => {
    render(
      <PlayerIdentityPill
        variant={{ piece: "knight", style: "golden", number: 4821 }}
        name="Golden Knight #4821"
      />,
    );
    expect(screen.getByText("Golden Knight #4821")).toBeTruthy();
    const labelled = screen.getByLabelText("Golden Knight #4821");
    expect(labelled).toBeTruthy();
    expect(labelled.textContent ?? "").not.toMatch(/0x/);
  });

  it("renders the decorative avatar with empty alt inside the pill", () => {
    const { container } = render(
      <PlayerIdentityPill
        variant={{ piece: "rook", style: "blue", number: 12 }}
        name="Blue Rook #12"
      />,
    );
    const img = container.querySelector("img") as HTMLImageElement;
    expect(img.getAttribute("alt")).toBe("");
  });
});
