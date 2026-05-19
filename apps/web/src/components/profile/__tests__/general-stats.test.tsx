import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { GeneralStats } from "@/components/profile/general-stats";

describe("<GeneralStats>", () => {
  it("always renders 6 stat cells, even at 0", () => {
    render(
      <GeneralStats
        piecesMastered={0}
        piecesTotal={6}
        dailyStreak={0}
        puzzlesSolved={0}
        arenaWins={0}
        trophies={0}
        nftsMinted={0}
      />,
    );
    expect(screen.getAllByRole("listitem")).toHaveLength(6);
  });

  it("formats Pieces Mastered as X/6", () => {
    render(
      <GeneralStats
        piecesMastered={3}
        piecesTotal={6}
        dailyStreak={14}
        puzzlesSolved={87}
        arenaWins={12}
        trophies={12}
        nftsMinted={4}
      />,
    );
    expect(screen.getByText("3 / 6")).toBeInTheDocument();
  });
});
