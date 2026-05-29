import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, vars?: Record<string, string | number>) => {
    if (!vars) return key;
    let out = key;
    for (const [k, v] of Object.entries(vars)) out = out.replace(`{${k}}`, String(v));
    return out;
  },
}));

vi.mock("@/components/board/board-thumbnail", () => ({
  BoardThumbnail: ({ fen, size }: { fen: string; size?: string }) => (
    <div data-testid="board-thumbnail" data-fen={fen} data-size={size} />
  ),
}));

import { GameViewer } from "../game-viewer";

describe("GameViewer", () => {
  const moves4 = ["e4", "e5", "Nf3", "Nc6"];

  it("renders BoardThumbnail at last move on mount", () => {
    render(<GameViewer moves={moves4} />);
    const board = screen.getByTestId("board-thumbnail");
    expect(board.getAttribute("data-fen")).toBeTruthy();
    expect(screen.getByText("Nc6")).toBeInTheDocument();
  });

  it("SAN list highlights current move", () => {
    // 2026-05-29 (Cluster C, M1): the move list is now an always-
    // visible static panel — no toggle prelude needed. Active move
    // identified by `data-active="true"` on the <li>.
    render(<GameViewer moves={moves4} />);
    const items = screen.getAllByRole("listitem");
    const active = items.find((el) => el.getAttribute("data-active") === "true");
    expect(active).toBeTruthy();
    expect(active?.textContent).toContain("Nc6");
  });

  it("zero moves: renders fallback, no SAN list", () => {
    // 2026-05-29 (Sally pass 2): GameViewer no longer renders the
    // replay row — those affordances moved up to coach-game-client
    // so they could be wrapped with the action tiles into one
    // bottom-anchored Action Deck. The empty-state assertion drops
    // the `no controls` clause for the same reason.
    render(<GameViewer moves={[]} />);
    expect(screen.getByText(/tooShortToReview/i)).toBeInTheDocument();
  });
});
