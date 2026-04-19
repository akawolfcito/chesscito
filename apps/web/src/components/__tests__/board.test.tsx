import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { Board } from "../board";

describe("<Board>", () => {
  it("renders a 64-cell grid of board buttons", () => {
    const { container } = render(<Board />);
    const cells = container.querySelectorAll(".playhub-board-cell");
    expect(cells).toHaveLength(64);
  });

  it("places the starting piece on the configured square", () => {
    const { container } = render(
      <Board pieceType="rook" startPosition={{ file: 0, rank: 0 }} />
    );
    const piece = container.querySelector(".playhub-board-piece-float");
    expect(piece).toBeInTheDocument();
    expect(piece?.querySelector("img")?.getAttribute("src")).toContain("rook");
  });

  it("locks all cells when isLocked is true", () => {
    const { container } = render(<Board isLocked />);
    const buttons = container.querySelectorAll<HTMLButtonElement>("button.playhub-board-cell");
    for (const b of buttons) {
      expect(b.disabled).toBe(true);
    }
  });

  it("renders a target marker on the designated target square in move mode", () => {
    const { container } = render(
      <Board
        pieceType="rook"
        startPosition={{ file: 0, rank: 0 }}
        targetPosition={{ file: 7, rank: 0 }}
      />
    );
    // The candy star marker lives on the highlighted target cell
    const target = container.querySelector(".playhub-board-target");
    expect(target).toBeInTheDocument();
  });
});
