import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { DailyTacticSheet } from "../daily-tactic-sheet";
import type { DailyPuzzle } from "@/lib/daily/puzzles";

// Use the canonical back-rank rook mate from the seed so the chess.js
// move validation runs the same path as production.
const PUZZLE: DailyPuzzle = {
  id: "test-mt-001",
  name: "Back rank — rook lift",
  fen: "6k1/5ppp/8/8/8/8/8/3R3K w - - 0 1",
  solution: { from: "d1", to: "d8" },
  hint: "Reach the eighth rank.",
};

afterEach(() => {
  cleanup();
});

function renderSheet(overrides: { open?: boolean; onSolve?: () => void; onOpenChange?: (open: boolean) => void } = {}) {
  const onSolve = overrides.onSolve ?? vi.fn();
  const onOpenChange = overrides.onOpenChange ?? vi.fn();
  render(
    <DailyTacticSheet
      open={overrides.open ?? true}
      onOpenChange={onOpenChange}
      puzzle={PUZZLE}
      onSolve={onSolve}
    />,
  );
  return { onSolve, onOpenChange };
}

describe("DailyTacticSheet — open state", () => {
  it("renders the puzzle title and prompt copy when open", () => {
    renderSheet();
    expect(screen.getByText(/Daily Tactic/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Back rank — rook lift — White to move, mate in one\./i),
    ).toBeInTheDocument();
    expect(screen.getByText(/Find the move that delivers checkmate\./i)).toBeInTheDocument();
  });

  it("does not render any sheet content when closed", () => {
    renderSheet({ open: false });
    expect(screen.queryByTestId("daily-tactic-sheet")).not.toBeInTheDocument();
  });
});

describe("DailyTacticSheet — solve flow", () => {
  it("fires onSolve when the player plays the solution move", () => {
    const { onSolve } = renderSheet();
    // Click source square (d1 = white rook), then target (d8) — both
    // exposed by ArenaBoard as buttons with role gridcell + accessible
    // label "Square X".
    fireEvent.click(screen.getByRole("gridcell", { name: "Square d1" }));
    fireEvent.click(screen.getByRole("gridcell", { name: "Square d8" }));
    expect(onSolve).toHaveBeenCalledOnce();
    expect(screen.getByTestId("daily-status-solved")).toBeInTheDocument();
  });
});

describe("DailyTacticSheet — wrong move flow", () => {
  it("does NOT fire onSolve and surfaces the hint when the player plays a wrong legal move", () => {
    const { onSolve } = renderSheet();
    // Pick the rook, then move to a wrong-but-legal square (d2).
    fireEvent.click(screen.getByRole("gridcell", { name: "Square d1" }));
    fireEvent.click(screen.getByRole("gridcell", { name: "Square d2" }));
    expect(onSolve).not.toHaveBeenCalled();
    expect(screen.queryByTestId("daily-status-solved")).not.toBeInTheDocument();
  });
});
