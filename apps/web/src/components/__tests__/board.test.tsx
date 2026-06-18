import { describe, it, expect, vi } from "vitest";
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

  // ─── Drag-to-move (Sprint 4 commit N — 2026-06-08) ──────────────────
  describe("drag-to-move", () => {
    /** Helper to find the piece <picture> element so we can target it
     *  with pointer events directly. */
    function getPiece(container: HTMLElement): HTMLElement {
      const el = container.querySelector(
        ".playhub-board-piece-float",
      ) as HTMLElement | null;
      if (!el) throw new Error("piece float not found");
      return el;
    }

    function getCell(label: string): HTMLElement {
      const el = document.querySelector(
        `[data-square="${label}"]`,
      ) as HTMLElement | null;
      if (!el) throw new Error(`cell ${label} not found`);
      return el;
    }

    /** jsdom doesn't implement document.elementFromPoint by default —
     *  we stub it to return whatever the test points at via the
     *  current call's clientX/Y. The helper threads a (label) → cell
     *  override so the drag-end resolution lands on the expected cell. */
    function stubElementFromPoint(targetLabel: string | null) {
      const fn = vi.fn(() =>
        targetLabel ? getCell(targetLabel) : null,
      );
      (document as unknown as { elementFromPoint: typeof fn }).elementFromPoint = fn;
      return fn;
    }

    it("drag onto a valid target executes the move via onMove", () => {
      const onMove = vi.fn();
      const { container } = render(
        <Board
          pieceType="rook"
          startPosition={{ file: 0, rank: 0 }}
          onMove={onMove}
        />,
      );
      const piece = getPiece(container);
      stubElementFromPoint("a8"); // rook a1 → a8 is a valid vertical move

      // pointerdown at (100, 200), move beyond threshold, pointerup
      // lands on a8 via the elementFromPoint stub.
      fireEvent.pointerDown(piece, { pointerId: 1, clientX: 100, clientY: 200 });
      fireEvent.pointerMove(piece, { pointerId: 1, clientX: 100, clientY: 80 });
      fireEvent.pointerUp(piece, { pointerId: 1, clientX: 100, clientY: 80 });

      expect(onMove).toHaveBeenCalledTimes(1);
      expect(onMove).toHaveBeenCalledWith({ file: 0, rank: 7 }, 1);
    });

    it("drag onto an invalid square does NOT move and snaps back", () => {
      const onMove = vi.fn();
      const { container } = render(
        <Board
          pieceType="rook"
          startPosition={{ file: 0, rank: 0 }}
          onMove={onMove}
        />,
      );
      const piece = getPiece(container);
      // b2 is NOT reachable by a rook starting at a1 (diagonal).
      stubElementFromPoint("b2");

      fireEvent.pointerDown(piece, { pointerId: 1, clientX: 100, clientY: 200 });
      fireEvent.pointerMove(piece, { pointerId: 1, clientX: 130, clientY: 170 });
      fireEvent.pointerUp(piece, { pointerId: 1, clientX: 130, clientY: 170 });

      expect(onMove).not.toHaveBeenCalled();
      expect(piece.className).toContain("is-snap-back");
    });

    it("pointerdown+up below threshold is treated as a tap (legacy flow)", () => {
      const onMove = vi.fn();
      const { container } = render(
        <Board
          pieceType="rook"
          startPosition={{ file: 0, rank: 0 }}
          onMove={onMove}
        />,
      );
      const piece = getPiece(container);
      stubElementFromPoint("a1"); // wouldn't matter — no drag

      // 3px move = below the 6px threshold → no drag promoted.
      fireEvent.pointerDown(piece, { pointerId: 1, clientX: 100, clientY: 200 });
      fireEvent.pointerMove(piece, { pointerId: 1, clientX: 102, clientY: 202 });
      fireEvent.pointerUp(piece, { pointerId: 1, clientX: 102, clientY: 202 });

      // Tap-as-piece selects the piece — the existing select shimmer
      // class is the proof. No onMove because tap-on-own-cell only
      // selects.
      expect(onMove).not.toHaveBeenCalled();
      expect(piece.className).toContain("is-selected");
    });

    it("drag is a no-op when isLocked is true", () => {
      const onMove = vi.fn();
      const { container } = render(
        <Board
          pieceType="rook"
          startPosition={{ file: 0, rank: 0 }}
          isLocked
          onMove={onMove}
        />,
      );
      const piece = getPiece(container);
      stubElementFromPoint("a8");

      fireEvent.pointerDown(piece, { pointerId: 1, clientX: 100, clientY: 200 });
      fireEvent.pointerMove(piece, { pointerId: 1, clientX: 100, clientY: 80 });
      fireEvent.pointerUp(piece, { pointerId: 1, clientX: 100, clientY: 80 });

      expect(onMove).not.toHaveBeenCalled();
      expect(piece.className).not.toContain("is-dragging");
    });

    it("drag released off-board snaps back (elementFromPoint returns null)", () => {
      const onMove = vi.fn();
      const { container } = render(
        <Board
          pieceType="rook"
          startPosition={{ file: 0, rank: 0 }}
          onMove={onMove}
        />,
      );
      const piece = getPiece(container);
      stubElementFromPoint(null);

      fireEvent.pointerDown(piece, { pointerId: 1, clientX: 100, clientY: 200 });
      fireEvent.pointerMove(piece, { pointerId: 1, clientX: 500, clientY: 600 });
      fireEvent.pointerUp(piece, { pointerId: 1, clientX: 500, clientY: 600 });

      expect(onMove).not.toHaveBeenCalled();
      expect(piece.className).toContain("is-snap-back");
    });
  });

  // ─── Procedural board flag (migration Phase 1, per-surface, default off) ──
  const FRAME_SRC = "/art/board/borde-tablero";

  describe("procedural board flag", () => {
    it("defaults to the image board (flag off) — byte-identical substrate", () => {
      const { container } = render(
        <Board pieceType="rook" startPosition={{ file: 0, rank: 0 }} />,
      );
      // Image substrate present, procedural frame absent.
      expect(container.querySelector(".playhub-board-img")).toBeInTheDocument();
      expect(
        container.querySelector(`img[src*="${FRAME_SRC}"]`),
      ).toBeNull();
    });

    it("renders the GameBoard substrate when proceduralBoard is on", () => {
      const { container } = render(
        <Board
          pieceType="rook"
          startPosition={{ file: 0, rank: 0 }}
          proceduralBoard
        />,
      );
      // Procedural frame present, image substrate gone.
      expect(
        container.querySelector(`img[src*="${FRAME_SRC}"]`),
      ).toBeInTheDocument();
      expect(container.querySelector(".playhub-board-img")).toBeNull();
      // Still 64 interactive cells (a11y parity: gridcells named "Square a1").
      expect(
        screen.getAllByRole("gridcell", { name: /^Square [a-h][1-8]$/ }),
      ).toHaveLength(64);
    });

    it("places the floating piece on the procedural board", () => {
      const { container } = render(
        <Board
          pieceType="rook"
          startPosition={{ file: 0, rank: 0 }}
          proceduralBoard
        />,
      );
      const piece = container.querySelector(".playhub-board-piece-float");
      expect(piece).toBeInTheDocument();
      expect(piece?.querySelector("img")?.getAttribute("src")).toContain("rook");
    });

    it("highlights valid targets after the piece is selected (procedural)", () => {
      const { container } = render(
        <Board
          pieceType="rook"
          startPosition={{ file: 0, rank: 0 }}
          proceduralBoard
        />,
      );
      // No dots before selection.
      expect(container.querySelector(".playhub-board-dot")).toBeNull();
      // Select the rook (gridcell named "Square a1", a11y parity).
      fireEvent.click(screen.getByRole("gridcell", { name: "Square a1" }));
      expect(container.querySelectorAll(".playhub-board-dot").length).toBeGreaterThan(0);
    });

    it("renders the target star marker on the procedural board", () => {
      const { container } = render(
        <Board
          pieceType="rook"
          startPosition={{ file: 0, rank: 0 }}
          targetPosition={{ file: 7, rank: 0 }}
          proceduralBoard
        />,
      );
      expect(container.querySelector(".playhub-board-target")).toBeInTheDocument();
    });

    it("paints labyrinth walls per cell on the procedural board", () => {
      const { container } = render(
        <Board
          pieceType="rook"
          startPosition={{ file: 0, rank: 0 }}
          mode="labyrinth"
          obstacles={[{ file: 3, rank: 3 }]}
          proceduralBoard
        />,
      );
      expect(container.querySelector(".playhub-board-cell.is-wall")).toBeInTheDocument();
    });
  });
});
