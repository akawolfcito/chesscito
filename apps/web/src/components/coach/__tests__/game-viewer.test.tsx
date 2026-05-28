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

  it("← / → controls disable at bounds", () => {
    render(<GameViewer moves={moves4} />);
    const prev = screen.getByRole("button", { name: /previousMove/i });
    const next = screen.getByRole("button", { name: /nextMove/i });
    expect(prev).toBeEnabled();
    expect(next).toBeDisabled();
    fireEvent.click(prev);
    expect(next).toBeEnabled();
  });

  it("SAN list highlights current move", () => {
    render(<GameViewer moves={moves4} />);
    const items = screen.getAllByRole("listitem");
    const active = items.find((el) => el.getAttribute("data-active") === "true");
    expect(active).toBeTruthy();
    expect(active?.textContent).toContain("Nc6");
  });

  it("zero moves: renders fallback, no SAN list, no controls", () => {
    render(<GameViewer moves={[]} />);
    expect(screen.getByText(/tooShortToReview/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /previousMove/i })).toBeNull();
  });

  it("partial-replay error: renders banner above the SAN list", () => {
    const corrupt = ["e4", "e5", "Nxd5"];
    render(<GameViewer moves={corrupt} />);
    expect(screen.getByText(/replayStoppedAtMove/i)).toBeInTheDocument();
  });

  it("slider syncs with currentIndex", () => {
    render(<GameViewer moves={moves4} />);
    const slider = screen.getByRole("slider");
    expect(slider).toHaveValue("4");
    fireEvent.change(slider, { target: { value: "2" } });
    expect(slider).toHaveValue("2");
  });
});
