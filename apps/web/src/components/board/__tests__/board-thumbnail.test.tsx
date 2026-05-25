import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";

import { BoardThumbnail } from "../board-thumbnail";

const STARTING_FEN =
  "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
const EMPTY_BOARD_FEN = "8/8/8/8/8/8/8/8 w - - 0 1";
const ENDGAME_FEN = "8/8/8/4k3/4K3/4P3/8/8 w - - 0 1"; // K+P vs K

describe("<BoardThumbnail>", () => {
  it("renders the board base image as a decorative <picture>", () => {
    const { container } = render(<BoardThumbnail fen={STARTING_FEN} />);
    const img = container.querySelector("img");
    expect(img).toBeTruthy();
    expect(img?.getAttribute("src")).toContain("/art/redesign/board/board-ch.png");
  });

  it("renders 32 pieces from the starting position", () => {
    const { container } = render(<BoardThumbnail fen={STARTING_FEN} />);
    // 1 board image + 32 piece images = 33 <img> elements.
    const imgs = container.querySelectorAll("img");
    expect(imgs.length).toBe(33);
  });

  it("renders no piece images for an empty board", () => {
    const { container } = render(<BoardThumbnail fen={EMPTY_BOARD_FEN} />);
    // Only the board image survives.
    expect(container.querySelectorAll("img").length).toBe(1);
  });

  it("renders only the live pieces for an endgame FEN (K+P vs K)", () => {
    const { container } = render(<BoardThumbnail fen={ENDGAME_FEN} />);
    // 1 board + 3 pieces.
    expect(container.querySelectorAll("img").length).toBe(4);
  });

  it("falls back to an empty board (no pieces) when the FEN is invalid", () => {
    const { container } = render(<BoardThumbnail fen={"not-a-fen"} />);
    // Only the board image survives; no pieces drawn.
    expect(container.querySelectorAll("img").length).toBe(1);
  });

  it("respects the size prop on the outer wrapper", () => {
    const { container } = render(<BoardThumbnail fen={STARTING_FEN} size={120} />);
    const root = container.firstElementChild as HTMLElement;
    expect(root.style.width).toBe("120px");
    expect(root.style.height).toBe("120px");
  });

  it("exposes role=img + the provided ariaLabel for screen readers", () => {
    const { container } = render(
      <BoardThumbnail fen={STARTING_FEN} ariaLabel="Final position of game from May 24" />,
    );
    const root = container.firstElementChild as HTMLElement;
    expect(root.getAttribute("role")).toBe("img");
    expect(root.getAttribute("aria-label")).toBe(
      "Final position of game from May 24",
    );
  });

  it("does NOT render any interactive elements (read-only contract)", () => {
    const { container } = render(<BoardThumbnail fen={STARTING_FEN} />);
    expect(container.querySelector("button")).toBeNull();
    expect(container.querySelector("[role='gridcell']")).toBeNull();
    expect(container.querySelector(".playhub-board-label")).toBeNull();
    expect(container.querySelector(".playhub-board-dot")).toBeNull();
  });
});
