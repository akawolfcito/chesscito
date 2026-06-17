import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  GameBoard,
  FILES,
  RANKS,
  isDarkSquare,
} from "@/lib/game/game-board";

describe("GameBoard (promoted procedural board)", () => {
  it("exports the 8 files and 8 ranks (top→bottom)", () => {
    expect(FILES).toEqual(["a", "b", "c", "d", "e", "f", "g", "h"]);
    expect(RANKS).toEqual([8, 7, 6, 5, 4, 3, 2, 1]);
  });

  it("alternates the tile texture toggle by (file,rank)", () => {
    // Texture toggle (not standard chess color): (file + (8-rank)) % 2 === 0.
    expect(isDarkSquare(0, 1)).toBe(false);
    expect(isDarkSquare(1, 1)).toBe(true);
    expect(isDarkSquare(0, 8)).toBe(true);
  });

  it("renders an accessible grid of 64 cells", () => {
    render(<GameBoard />);
    expect(screen.getByRole("grid", { name: /chess board/i })).toBeInTheDocument();
    expect(screen.getAllByRole("gridcell")).toHaveLength(64);
  });

  it("makes cells interactive buttons when onCellClick is set", () => {
    const onCellClick = vi.fn();
    render(<GameBoard onCellClick={onCellClick} />);
    const buttons = screen.getAllByRole("button");
    expect(buttons).toHaveLength(64);
  });
});
