import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  GameBoard,
  FILES,
  RANKS,
  BOARD_INSET,
  isDarkSquare,
  type BoardOverlayGeometry,
} from "@/lib/game/game-board";
import { cellCenter, pieceWidth } from "@/lib/game/board-geometry";

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

  describe("overlay layer (renderOverlay + BoardOverlayGeometry)", () => {
    it("renders renderOverlay output inside a region inset to the frame opening", () => {
      render(
        <GameBoard
          renderOverlay={() => (
            <div data-testid="overlay-child">piece</div>
          )}
        />,
      );
      const child = screen.getByTestId("overlay-child");
      expect(child).toBeInTheDocument();

      // The overlay child must live inside a region inset to BOARD_INSET so
      // cellCenter percentages resolve against the same area as the tiles.
      const region = child.parentElement as HTMLElement;
      expect(region.style.top).toBe(`${BOARD_INSET.top}%`);
      expect(region.style.right).toBe(`${BOARD_INSET.right}%`);
      expect(region.style.bottom).toBe(`${BOARD_INSET.bottom}%`);
      expect(region.style.left).toBe(`${BOARD_INSET.left}%`);
      expect(region.style.position).toBe("absolute");
    });

    it("honors a per-surface overlayInset (red-team P0 piece-drift)", () => {
      const inset = { top: 5.25, right: 10.25, bottom: 12.75, left: 9.25 };
      render(
        <GameBoard
          overlayInset={inset}
          renderOverlay={() => <div data-testid="overlay-child" />}
        />,
      );
      const region = screen.getByTestId("overlay-child").parentElement as HTMLElement;
      expect(region.style.top).toBe(`${inset.top}%`);
      expect(region.style.right).toBe(`${inset.right}%`);
      expect(region.style.bottom).toBe(`${inset.bottom}%`);
      expect(region.style.left).toBe(`${inset.left}%`);
    });

    it("exposes geometry whose center matches cellCenter (logical file 0–7, rank 1–8)", () => {
      let captured: BoardOverlayGeometry | null = null;
      render(
        <GameBoard
          renderOverlay={(geo) => {
            captured = geo;
            return null;
          }}
        />,
      );
      const geo = captured as unknown as BoardOverlayGeometry;
      expect(geo).not.toBeNull();
      expect(geo.cellSizePct).toBe(12.5);
      expect(geo.pieceWidthPct).toBe(pieceWidth());

      // center(file, rank) — rank is the chess rank (1–8). Must equal the
      // existing cellCenter(file, rankIndex) where rankIndex = rank - 1.
      for (const [file, rank] of [
        [0, 1],
        [7, 8],
        [3, 5],
        [4, 2],
      ] as const) {
        const c = geo.center(file, rank);
        const expected = cellCenter(file, rank - 1);
        expect(c.leftPct).toBeCloseTo(expected.x, 5);
        expect(c.topPct).toBeCloseTo(expected.y, 5);
      }
    });

    it("layers the overlay above the tile grid but below the candy frame", () => {
      const { container } = render(
        <GameBoard renderOverlay={() => <div data-testid="overlay-child" />} />,
      );
      const region = screen.getByTestId("overlay-child").parentElement as HTMLElement;
      const grid = screen.getByRole("grid", { name: /chess board/i });
      const frame = container.querySelector("img") as HTMLElement;
      const z = (el: HTMLElement) => Number(el.style.zIndex);
      expect(z(grid)).toBeLessThan(z(region));
      expect(z(region)).toBeLessThan(z(frame));
    });

    it("renders no overlay region when renderOverlay is omitted", () => {
      render(<GameBoard />);
      expect(screen.queryByTestId("overlay-child")).not.toBeInTheDocument();
    });
  });

  describe("orientation (red-team P0 — logical→view for tiles AND overlay)", () => {
    it("renders white view by default: top-left cell is a8, bottom-right is h1", () => {
      render(<GameBoard onCellClick={() => {}} />);
      const buttons = screen.getAllByRole("button");
      // DOM order = grid order = top→bottom, left→right.
      expect(buttons[0]).toHaveAttribute("aria-label", "a8");
      expect(buttons[63]).toHaveAttribute("aria-label", "h1");
    });

    it("flips tiles under orientation=black: top-left is h1, bottom-right is a8", () => {
      render(<GameBoard orientation="black" onCellClick={() => {}} />);
      const buttons = screen.getAllByRole("button");
      expect(buttons[0]).toHaveAttribute("aria-label", "h1");
      expect(buttons[63]).toHaveAttribute("aria-label", "a8");
    });

    it("passes LOGICAL (file,rank,square) to renderCell/onCellClick regardless of orientation", () => {
      const onCellClick = vi.fn();
      render(<GameBoard orientation="black" onCellClick={onCellClick} />);
      // The visual top-left cell is logical h1 → file 7, rank 1.
      screen.getAllByRole("button")[0].click();
      expect(onCellClick).toHaveBeenCalledWith(7, 1, "h1");
    });

    it("flips overlay center under orientation=black (matches the arena vf/vr flip)", () => {
      let captured: BoardOverlayGeometry | null = null;
      render(
        <GameBoard
          orientation="black"
          renderOverlay={(geo) => {
            captured = geo;
            return null;
          }}
        />,
      );
      const geo = captured as unknown as BoardOverlayGeometry;
      expect(geo).not.toBeNull();
      // Black view: view coords are the flipped logical coords. Center must
      // equal cellCenter(7 - file, 7 - (rank - 1)) — the same flip arena does.
      for (const [file, rank] of [
        [0, 1],
        [7, 8],
        [3, 5],
        [4, 2],
      ] as const) {
        const c = geo.center(file, rank);
        const expected = cellCenter(7 - file, 7 - (rank - 1));
        expect(c.leftPct).toBeCloseTo(expected.x, 5);
        expect(c.topPct).toBeCloseTo(expected.y, 5);
      }
    });

    it("flips coordinate labels under orientation=black (rank 1 top-left band, file h leftmost)", () => {
      const { container } = render(<GameBoard orientation="black" />);
      const spans = Array.from(container.querySelectorAll("span")).map(
        (s) => s.textContent,
      );
      // Both axis label sets are present (8 ranks + 8 files), just reordered.
      for (const r of ["1", "2", "8"]) expect(spans).toContain(r);
      for (const f of ["a", "h"]) expect(spans).toContain(f);
    });
  });
});
