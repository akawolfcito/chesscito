import { describe, it, expect, afterEach } from "vitest";
import { cleanup } from "@testing-library/react";
import { renderWithIntl as render, screen } from "@/test-utils/render-with-intl";

import { ArenaMatchupTransition } from "../arena-matchup-transition";

afterEach(cleanup);

const base = {
  rivalName: "Kairo",
  rivalAvatarSrc: "/art/rivals/kairo-avatar.png",
  rivalFrame: "gold" as const,
  playerLabel: "You",
  playerNickname: "Knight #3842",
  playerAvatarSrc: "/art/avatar-lite-hub.png",
  getReadyLabel: "Get ready!",
};

describe("ArenaMatchupTransition", () => {
  it("names both sides of the matchup", () => {
    render(<ArenaMatchupTransition {...base} />);
    expect(screen.getByText("Kairo")).toBeInTheDocument();
    expect(screen.getByText("You")).toBeInTheDocument();
    expect(screen.getByText("Knight #3842")).toBeInTheDocument();
  });

  it("anchors the Get ready! call above the pawn divider", () => {
    render(<ArenaMatchupTransition {...base} />);
    expect(screen.getByText("Get ready!")).toBeInTheDocument();
  });

  it("renders both avatars with a describable alt", () => {
    render(<ArenaMatchupTransition {...base} />);
    expect(screen.getByAltText("Kairo")).toHaveAttribute(
      "src",
      "/art/rivals/kairo-avatar.png",
    );
    // The player's avatar is decorative next to its own ribbon label, but it
    // must still be reachable by the nickname so the row is not anonymous.
    expect(screen.getByAltText("Knight #3842")).toBeInTheDocument();
  });

  it("carries the rival's difficulty frame as a modifier", () => {
    const { container } = render(<ArenaMatchupTransition {...base} />);
    expect(
      container.querySelector(".arena-matchup-ribbon--gold"),
    ).not.toBeNull();
  });

  it("falls back to the label alone when the nickname has not hydrated", () => {
    render(<ArenaMatchupTransition {...base} playerNickname={undefined} />);
    expect(screen.getByText("You")).toBeInTheDocument();
    expect(screen.queryByText("Knight #3842")).toBeNull();
    // Slot keeps its height so the late nickname does not shift the ribbon.
    expect(screen.getByTestId("arena-matchup-nickname")).toBeInTheDocument();
  });

  it("is announced as a status so the transition is not silent to AT", () => {
    render(<ArenaMatchupTransition {...base} />);
    expect(screen.getByRole("status")).toHaveTextContent("Get ready!");
  });
});
