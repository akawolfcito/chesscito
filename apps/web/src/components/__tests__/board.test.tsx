import { describe, it, expect } from "vitest";
import { render, fireEvent, screen } from "@testing-library/react";
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

  // ─── Tap-hint (red-team P0-P3 — iPhone field report 2026-05-31) ──────────

  describe("tap-piece hint", () => {
    it("shows the hint when an empty cell is tapped with no piece selected", () => {
      const { container } = render(
        <Board pieceType="rook" startPosition={{ file: 0, rank: 0 }} />
      );
      expect(container.querySelector(".playhub-board-select-hint")).toBeNull();

      // Tap an empty far square (no piece, no prior selection).
      fireEvent.click(screen.getByRole("gridcell", { name: "Square d4" }));

      const hint = container.querySelector(".playhub-board-select-hint");
      expect(hint).toBeInTheDocument();
      expect(hint?.textContent).toMatch(/tap your piece/i);
    });

    it("does NOT show the hint when the user taps the piece itself", () => {
      const { container } = render(
        <Board pieceType="rook" startPosition={{ file: 0, rank: 0 }} />
      );
      fireEvent.click(screen.getByRole("gridcell", { name: "Square a1" }));
      expect(container.querySelector(".playhub-board-select-hint")).toBeNull();
    });

    it("does NOT show the hint after the piece is selected (only reject animation runs)", () => {
      const { container } = render(
        <Board pieceType="rook" startPosition={{ file: 0, rank: 0 }} />
      );
      // 1. Select the piece.
      fireEvent.click(screen.getByRole("gridcell", { name: "Square a1" }));
      // 2. Tap a square the rook cannot reach (b2 — diagonal blocked).
      fireEvent.click(screen.getByRole("gridcell", { name: "Square b2" }));
      expect(container.querySelector(".playhub-board-select-hint")).toBeNull();
    });

    it("does NOT show the hint in tutorial mode (interaction disabled)", () => {
      const { container } = render(
        <Board pieceType="rook" startPosition={{ file: 0, rank: 0 }} mode="tutorial" />
      );
      fireEvent.click(screen.getByRole("gridcell", { name: "Square d4" }));
      expect(container.querySelector(".playhub-board-select-hint")).toBeNull();
    });

    // ─── Placement: pill never clips the board edge ─────────────────────
    // Piece on a-file & low rank → render to the right.
    // Piece on h-file & low rank → render to the left.
    // Piece on top ranks → render below (otherwise pill clips the top edge).
    // Anywhere else → render above (default).

    it("places hint to the right when the piece is on the left edge (a-file)", () => {
      const { container } = render(
        <Board pieceType="rook" startPosition={{ file: 0, rank: 0 }} />
      );
      fireEvent.click(screen.getByRole("gridcell", { name: "Square d4" }));
      const hint = container.querySelector(".playhub-board-select-hint");
      expect(hint?.getAttribute("data-placement")).toBe("right");
    });

    it("places hint to the left when the piece is on the right edge (h-file)", () => {
      const { container } = render(
        <Board pieceType="rook" startPosition={{ file: 7, rank: 0 }} />
      );
      fireEvent.click(screen.getByRole("gridcell", { name: "Square d4" }));
      const hint = container.querySelector(".playhub-board-select-hint");
      expect(hint?.getAttribute("data-placement")).toBe("left");
    });

    it("places hint below the piece when the piece is on the top ranks (rank 7-8)", () => {
      const { container } = render(
        <Board pieceType="rook" startPosition={{ file: 3, rank: 7 }} />
      );
      fireEvent.click(screen.getByRole("gridcell", { name: "Square d4" }));
      const hint = container.querySelector(".playhub-board-select-hint");
      expect(hint?.getAttribute("data-placement")).toBe("bottom");
    });

    it("places hint above the piece (default) when in the central interior", () => {
      const { container } = render(
        <Board pieceType="rook" startPosition={{ file: 3, rank: 3 }} />
      );
      fireEvent.click(screen.getByRole("gridcell", { name: "Square h8" }));
      const hint = container.querySelector(".playhub-board-select-hint");
      expect(hint?.getAttribute("data-placement")).toBe("top");
    });
  });
});
