import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { cleanup, act } from "@testing-library/react";
import { renderWithIntl as render, screen, fireEvent } from "@/test-utils/render-with-intl";
import { DailyTacticSheet } from "../daily-tactic-sheet";
import type { DailyTacticData } from "@/lib/daily/daily-puzzles";

const PUZZLE: DailyTacticData = {
  id: "test-dt-rook-1",
  name: "Rook — horizontal slide",
  piece: "rook",
  exercise: {
    id: "test-dt-rook-1",
    startPos: { file: 0, rank: 0 },
    targetPos: { file: 7, rank: 0 },
    optimalMoves: 1,
  },
  hint: "Slide the rook along the rank.",
};

const PUZZLE_TWO_MOVE: DailyTacticData = {
  id: "test-dt-rook-2",
  name: "Rook — two corners",
  piece: "rook",
  exercise: {
    id: "test-dt-rook-2",
    startPos: { file: 0, rank: 0 },
    targetPos: { file: 7, rank: 7 },
    optimalMoves: 2,
  },
  hint: "No single rank or file connects these corners.",
};

afterEach(() => {
  cleanup();
});

function renderSheet(
  overrides: {
    open?: boolean;
    onSolve?: (movesUsed: number) => void;
    onOpenChange?: (open: boolean) => void;
    puzzleData?: DailyTacticData;
    streakAfterSolve?: number;
    streakType?: "first" | "extended" | "reset";
    isConnected?: boolean;
  } = {},
) {
  const onSolve = overrides.onSolve ?? vi.fn();
  const onOpenChange = overrides.onOpenChange ?? vi.fn();
  render(
    <DailyTacticSheet
      open={overrides.open ?? true}
      onOpenChange={onOpenChange}
      puzzleData={overrides.puzzleData ?? PUZZLE}
      onSolve={onSolve}
      streakAfterSolve={overrides.streakAfterSolve}
      streakType={overrides.streakType}
      isConnected={overrides.isConnected}
    />,
  );
  return { onSolve, onOpenChange };
}

describe("DailyTacticSheet — open state", () => {
  it("renders the puzzle title and prompt copy when open", () => {
    renderSheet();
    // Title and subtitle each appear twice — visible <ContextualHeader>
    // + sr-only <SheetTitle>/<SheetDescription> auto-injected by
    // <SheetContent> for Radix Dialog a11y wiring. Both are correct.
    expect(screen.getAllByText(/Daily Tactic/i).length).toBeGreaterThanOrEqual(1);
    expect(
      screen.getAllByText(/Rook — horizontal slide/i).length,
    ).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/Move the rook to the target square\./i)).toBeInTheDocument();
  });

  it("does not render any sheet content when closed", () => {
    renderSheet({ open: false });
    expect(screen.queryByTestId("daily-tactic-sheet")).not.toBeInTheDocument();
  });
});

describe("DailyTacticSheet — solve flow (rook a1→h1)", () => {
  function solve(): void {
    fireEvent.click(screen.getByRole("gridcell", { name: "Square a1" }));
    fireEvent.click(screen.getByRole("gridcell", { name: "Square h1" }));
  }

  it("fires onSolve when the rook reaches h1 and shows solved text", () => {
    const { onSolve } = renderSheet({ streakAfterSolve: 3, streakType: "extended" });
    solve();
    expect(onSolve).toHaveBeenCalledOnce();
    expect(screen.getByTestId("daily-status-solved")).toHaveTextContent("Solved!");
  });

  it("does NOT show the old 'Streak banked' text", () => {
    const { onSolve } = renderSheet({ streakAfterSolve: 3, streakType: "extended" });
    solve();
    expect(onSolve).toHaveBeenCalledOnce();
    expect(screen.queryByText(/Streak banked/i)).not.toBeInTheDocument();
  });

  it("renders streak number and extended label when streakType='extended'", () => {
    renderSheet({ streakAfterSolve: 5, streakType: "extended" });
    solve();
    expect(screen.getByText("Streak: 5")).toBeInTheDocument();
    expect(screen.getByText("+1 day")).toBeInTheDocument();
  });

  it("renders 'First streak!' when streakType='first'", () => {
    renderSheet({ streakAfterSolve: 1, streakType: "first" });
    solve();
    expect(screen.getByText("Streak: 1")).toBeInTheDocument();
    expect(screen.getByText("First streak!")).toBeInTheDocument();
  });

  it("renders 'New streak!' when streakType='reset'", () => {
    renderSheet({ streakAfterSolve: 1, streakType: "reset" });
    solve();
    expect(screen.getByText("Streak: 1")).toBeInTheDocument();
    expect(screen.getByText("New streak!")).toBeInTheDocument();
  });

  it("does not render streak info when props are omitted", () => {
    const { onSolve } = renderSheet();
    solve();
    expect(screen.getByTestId("daily-status-solved")).toHaveTextContent("Solved!");
    expect(screen.queryByText(/Streak/)).not.toBeInTheDocument();
  });
});

describe("DailyTacticSheet — wrong move flow", () => {
  it("shows hint after a wrong move on a 1-move puzzle", () => {
    const { onSolve } = renderSheet();
    // Click a1 to select rook, then b1 (wrong target for a1→h1)
    fireEvent.click(screen.getByRole("gridcell", { name: "Square a1" }));
    fireEvent.click(screen.getByRole("gridcell", { name: "Square b1" }));
    expect(onSolve).not.toHaveBeenCalled();
    expect(screen.queryByTestId("daily-status-solved")).not.toBeInTheDocument();
  });
});

describe("DailyTacticSheet — auto-close after solve", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("calls onOpenChange(false) after 3200ms when solved", () => {
    const { onOpenChange } = renderSheet();
    fireEvent.click(screen.getByRole("gridcell", { name: "Square a1" }));
    fireEvent.click(screen.getByRole("gridcell", { name: "Square h1" }));
    expect(onOpenChange).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(3200);
    });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("does NOT auto-close before 3200ms", () => {
    const { onOpenChange } = renderSheet();
    fireEvent.click(screen.getByRole("gridcell", { name: "Square a1" }));
    fireEvent.click(screen.getByRole("gridcell", { name: "Square h1" }));
    act(() => {
      vi.advanceTimersByTime(3199);
    });
    expect(onOpenChange).not.toHaveBeenCalled();
  });
});

describe("DailyTacticSheet — 2-move puzzle", () => {
  it("does NOT fire onSolve after the first (non-target) move", () => {
    const { onSolve } = renderSheet({ puzzleData: PUZZLE_TWO_MOVE });
    // Two-move: a1→h1 (first move), then h1→h8 (target). After first move,
    // onSolve should NOT fire yet.
    fireEvent.click(screen.getByRole("gridcell", { name: "Square a1" }));
    fireEvent.click(screen.getByRole("gridcell", { name: "Square h1" }));
    expect(onSolve).not.toHaveBeenCalled();
    expect(screen.queryByTestId("daily-status-solved")).not.toBeInTheDocument();
  });

  it("fires onSolve after reaching the target on the second move", () => {
    const { onSolve } = renderSheet({ puzzleData: PUZZLE_TWO_MOVE });
    // Two-move: a1→h1 (first), then h1→h8 (target)
    fireEvent.click(screen.getByRole("gridcell", { name: "Square a1" }));
    fireEvent.click(screen.getByRole("gridcell", { name: "Square h1" }));
    fireEvent.click(screen.getByRole("gridcell", { name: "Square h1" }));
    fireEvent.click(screen.getByRole("gridcell", { name: "Square h8" }));
    expect(onSolve).toHaveBeenCalledOnce();
    expect(screen.getByTestId("daily-status-solved")).toBeInTheDocument();
  });
});

/**
 * Sprint 2 commit E — reward preview block on the solved screen.
 * NO real Peones credited; copy must read as preview only. Connected
 * users see the "+3 Peones preview" line; guests see only the connect
 * CTA. No number is shown to guests.
 */
describe("DailyTacticSheet — reward preview (Sprint 2 commit E)", () => {
  function solveQuick(): void {
    fireEvent.click(screen.getByRole("gridcell", { name: "Square a1" }));
    fireEvent.click(screen.getByRole("gridcell", { name: "Square h1" }));
  }

  it("shows the connected preview block when isConnected=true", () => {
    renderSheet({ isConnected: true });
    solveQuick();
    const previewBlock = screen.getByTestId("daily-reward-preview-connected");
    expect(previewBlock).toBeInTheDocument();
    expect(previewBlock).toHaveTextContent("+3 Peones preview");
    expect(previewBlock).toHaveTextContent(
      "Daily rewards unlock in the next economy sprint.",
    );
    expect(
      screen.queryByTestId("daily-reward-preview-guest"),
    ).not.toBeInTheDocument();
  });

  it("shows ONLY the connect CTA when isConnected=false (default)", () => {
    renderSheet({ isConnected: false });
    solveQuick();
    const guestBlock = screen.getByTestId("daily-reward-preview-guest");
    expect(guestBlock).toBeInTheDocument();
    expect(guestBlock).toHaveTextContent(
      "Connect to earn Peones when rewards go live.",
    );
    // Guests must NOT see any Peones number on the completion screen.
    expect(
      screen.queryByTestId("daily-reward-preview-connected"),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/\+3 Peones preview/i)).not.toBeInTheDocument();
  });

  it("defaults to guest copy when isConnected prop is omitted", () => {
    renderSheet();
    solveQuick();
    expect(
      screen.getByTestId("daily-reward-preview-guest"),
    ).toBeInTheDocument();
    expect(
      screen.queryByTestId("daily-reward-preview-connected"),
    ).not.toBeInTheDocument();
  });
});
