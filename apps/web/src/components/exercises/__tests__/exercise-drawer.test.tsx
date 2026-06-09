import { describe, expect, it, vi } from "vitest";
import { fireEvent } from "@testing-library/react";
import { renderWithIntl as render, screen } from "@/test-utils/render-with-intl";
import { ExerciseDrawer } from "../exercise-drawer";
import { EXERCISES } from "@/lib/game/exercises";

const baseProps = {
  open: true,
  onOpenChange: vi.fn(),
  piece: "rook" as const,
  exercises: EXERCISES.rook,
  stars: new Array(10).fill(0),
  activeIndex: 0,
  totalStars: 0,
};

function clickRow(description: string) {
  const label = screen.getByText(description);
  const button = label.closest("button");
  if (!button) throw new Error(`No button for "${description}"`);
  fireEvent.click(button);
  return button;
}

describe("ExerciseDrawer — legacy (no visibleExerciseIds)", () => {
  it("renders the full pool and locks beyond the linear senda", () => {
    render(<ExerciseDrawer {...baseProps} onNavigate={vi.fn()} />);
    // Full list present.
    expect(screen.getByText("Horizontal move")).toBeInTheDocument(); // rook-1
    expect(screen.getByText("Boxed-in square")).toBeInTheDocument(); // rook-8
    // Fresh progress → only index 0 unlocked; a later one is disabled.
    const locked = screen.getByText("Cross capture").closest("button"); // rook-5
    expect(locked).toBeDisabled();
  });

  it("navigates by pool index for an unlocked row", () => {
    const onNavigate = vi.fn();
    render(<ExerciseDrawer {...baseProps} onNavigate={onNavigate} />);
    clickRow("Horizontal move"); // rook-1, pool index 0
    expect(onNavigate).toHaveBeenCalledWith(0);
  });
});

describe("ExerciseDrawer — rotation (visibleExerciseIds set)", () => {
  const visible = new Set(["rook-3", "rook-6", "rook-8"]); // pool idx 2, 5, 7

  it("renders ONLY today's visible set", () => {
    render(
      <ExerciseDrawer
        {...baseProps}
        onNavigate={vi.fn()}
        visibleExerciseIds={visible}
      />,
    );
    expect(screen.getByText("Center to edge")).toBeInTheDocument(); // rook-3
    expect(screen.getByText("Around the wall")).toBeInTheDocument(); // rook-6
    expect(screen.getByText("Boxed-in square")).toBeInTheDocument(); // rook-8
    // Outside the set → not rendered.
    expect(screen.queryByText("Horizontal move")).not.toBeInTheDocument(); // rook-1
    expect(screen.queryByText("Vertical move")).not.toBeInTheDocument(); // rook-2
  });

  it("treats visible-set exercises as playable (not senda-locked)", () => {
    render(
      <ExerciseDrawer
        {...baseProps}
        onNavigate={vi.fn()}
        visibleExerciseIds={visible}
      />,
    );
    // rook-8 is pool index 7 — legacy would lock it; rotation keeps it open.
    expect(screen.getByText("Boxed-in square").closest("button")).not.toBeDisabled();
  });

  it("navigates with the REAL pool index, not the visible-slot index", () => {
    const onNavigate = vi.fn();
    render(
      <ExerciseDrawer
        {...baseProps}
        onNavigate={onNavigate}
        visibleExerciseIds={visible}
      />,
    );
    // "Boxed-in square" = rook-8 = pool index 7 (the 3rd visible row).
    clickRow("Boxed-in square");
    expect(onNavigate).toHaveBeenCalledWith(7);
  });
});
