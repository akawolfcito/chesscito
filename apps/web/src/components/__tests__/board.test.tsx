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

  // ─── Procedural board substrate (P4b: now the only board, no flag) ──────
  const FRAME_SRC = "/art/board/borde-tablero";

  describe("procedural board substrate", () => {
    it("renders the GameBoard substrate (candy frame, no background image)", () => {
      const { container } = render(
        <Board pieceType="rook" startPosition={{ file: 0, rank: 0 }} />,
      );
      expect(
        container.querySelector(`img[src*="${FRAME_SRC}"]`),
      ).toBeInTheDocument();
      expect(container.querySelector(".playhub-board-img")).toBeNull();
      // 64 interactive cells (a11y parity: gridcells named "Square a1").
      expect(
        screen.getAllByRole("gridcell", { name: /^Square [a-h][1-8]$/ }),
      ).toHaveLength(64);
    });

    it("places the floating piece on the board", () => {
      const { container } = render(
        <Board pieceType="rook" startPosition={{ file: 0, rank: 0 }} />,
      );
      const piece = container.querySelector(".playhub-board-piece-float");
      expect(piece).toBeInTheDocument();
      expect(piece?.querySelector("img")?.getAttribute("src")).toContain("rook");
    });

    it("highlights valid targets after the piece is selected", () => {
      const { container } = render(
        <Board pieceType="rook" startPosition={{ file: 0, rank: 0 }} />,
      );
      expect(container.querySelector(".playhub-board-dot")).toBeNull();
      fireEvent.click(screen.getByRole("gridcell", { name: "Square a1" }));
      expect(container.querySelectorAll(".playhub-board-dot").length).toBeGreaterThan(0);
    });

    it("renders the target star marker", () => {
      const { container } = render(
        <Board
          pieceType="rook"
          startPosition={{ file: 0, rank: 0 }}
          targetPosition={{ file: 7, rank: 0 }}
        />,
      );
      expect(container.querySelector(".playhub-board-target")).toBeInTheDocument();
    });

    it("paints labyrinth walls per cell", () => {
      const { container } = render(
        <Board
          pieceType="rook"
          startPosition={{ file: 0, rank: 0 }}
          mode="labyrinth"
          obstacles={[{ file: 3, rank: 3 }]}
        />,
      );
      expect(container.querySelector(".playhub-board-cell.is-wall")).toBeInTheDocument();
    });
  });

  /**
   * A9 — the two surfaces mean different things, so they must not look alike.
   *
   * In a MAZE the obstacle is scenery: a stone wall marking the level's edge.
   * In an EXERCISE it is a chess rule — "you cannot jump over your own piece,
   * and you cannot capture it" — and painting that as a wall teaches the wrong
   * lesson: the player reads a boundary instead of a piece.
   */
  describe("blockers — practice vs labyrinth", () => {
    const obstacles = [{ file: 3, rank: 3 }];

    it("renders a friendly PIECE in practice, never a wall", () => {
      const { container } = render(
        <Board
          pieceType="rook"
          startPosition={{ file: 0, rank: 0 }}
          mode="practice"
          obstacles={obstacles}
        />,
      );
      expect(
        container.querySelector(".playhub-board-piece-float.is-friendly-blocker"),
      ).toBeInTheDocument();
      expect(container.querySelector(".playhub-board-cell.is-wall")).toBeNull();
    });

    it("renders a WALL in the labyrinth, never a friendly piece", () => {
      const { container } = render(
        <Board
          pieceType="rook"
          startPosition={{ file: 0, rank: 0 }}
          mode="labyrinth"
          obstacles={obstacles}
        />,
      );
      expect(container.querySelector(".playhub-board-cell.is-wall")).toBeInTheDocument();
      expect(
        container.querySelector(".playhub-board-piece-float.is-friendly-blocker"),
      ).toBeNull();
    });

    it("paints one blocker per obstacle in practice", () => {
      const { container } = render(
        <Board
          pieceType="rook"
          startPosition={{ file: 0, rank: 0 }}
          mode="practice"
          obstacles={[
            { file: 3, rank: 3 },
            { file: 4, rank: 4 },
            { file: 5, rank: 5 },
          ]}
        />,
      );
      expect(
        container.querySelectorAll(".playhub-board-piece-float.is-friendly-blocker"),
      ).toHaveLength(3);
    });

    it("keeps the blocker out of the way of taps", () => {
      // It must never swallow the tap: the cell button underneath has to receive
      // it and refuse the move, which is the rule doing the teaching.
      const { container } = render(
        <Board
          pieceType="rook"
          startPosition={{ file: 0, rank: 0 }}
          mode="practice"
          obstacles={obstacles}
        />,
      );
      const blocker = container.querySelector<HTMLElement>(
        ".playhub-board-piece-float.is-friendly-blocker",
      );
      expect(blocker?.style.pointerEvents).toBe("none");
      // aria-hidden lives on the inner <img> (a <picture> does not support ARIA);
      // the decorative blocker stays out of the a11y tree either way.
      expect(blocker?.querySelector("img")?.getAttribute("aria-hidden")).toBe("true");
    });
  });

  describe("move trail", () => {
    it("draws a trail line from origin to destination after a move", () => {
      const { container } = render(
        <Board pieceType="rook" startPosition={{ file: 0, rank: 0 }} mode="practice" />,
      );
      expect(container.querySelector(".playhub-board-trail")).toBeNull();

      // Select the rook (a1) then move it up the file to a8.
      fireEvent.click(screen.getByRole("gridcell", { name: "Square a1" }));
      fireEvent.click(screen.getByRole("gridcell", { name: "Square a8" }));

      const line = container.querySelector(".playhub-board-trail line");
      expect(line).not.toBeNull();
      // The line runs from the a1 cell to the a8 cell (same file → same x,
      // different y), so it traces the path the rook actually travelled.
      expect(line?.getAttribute("x1")).toBe(line?.getAttribute("x2"));
      expect(line?.getAttribute("y1")).not.toBe(line?.getAttribute("y2"));
    });

    it("shows no trail before any move", () => {
      const { container } = render(<Board pieceType="rook" mode="practice" />);
      expect(container.querySelector(".playhub-board-trail")).toBeNull();
    });
  });
});
