import { describe, expect, it, vi } from "vitest";
import { fireEvent } from "@testing-library/react";
import { renderWithIntl as render, screen } from "@/test-utils/render-with-intl";
import { ExerciseDrawer } from "../exercise-drawer";
import { EXERCISES } from "@/lib/game/exercises";
import { buildTrainingPath } from "@/lib/training/path";

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

describe("ExerciseDrawer — labyrinth nodes (Slice 3D)", () => {
  const zeros = new Array(10).fill(0);
  const sixStars = [3, 3, ...new Array(8).fill(0)];

  function rookLabNodes(stars: number[], bests: Record<string, number> = {}) {
    return buildTrainingPath({
      piece: "rook",
      progress: { piece: "rook", exerciseIndex: 0, stars },
      labyrinthBests: bests,
      badgeClaimed: false,
    }).filter((node) => node.kind === "labyrinth");
  }

  it("renders labyrinth rows in the main selector", () => {
    render(
      <ExerciseDrawer
        {...baseProps}
        onNavigate={vi.fn()}
        labyrinthNodes={rookLabNodes(zeros)}
        onLabyrinthSelect={vi.fn()}
      />,
    );
    expect(screen.getByText("Labyrinth 1")).toBeInTheDocument();
    expect(screen.getByText("Labyrinth 3")).toBeInTheDocument();
  });

  it("locked labs are disabled with rule copy and never fire the handler", () => {
    const onLabyrinthSelect = vi.fn();
    render(
      <ExerciseDrawer
        {...baseProps}
        onNavigate={vi.fn()}
        labyrinthNodes={rookLabNodes(zeros)}
        onLabyrinthSelect={onLabyrinthSelect}
      />,
    );
    expect(screen.getByText("Unlocks at 6★")).toBeInTheDocument();
    const locked = screen.getByText("Labyrinth 1").closest("button");
    expect(locked).toBeDisabled();
    if (locked) fireEvent.click(locked);
    expect(onLabyrinthSelect).not.toHaveBeenCalled();
  });

  it("available lab fires onLabyrinthSelect with its id and closes the drawer", () => {
    const onLabyrinthSelect = vi.fn();
    const onOpenChange = vi.fn();
    const nodes = rookLabNodes(sixStars);
    // "Labyrinth 1" is the first lab node as buildTrainingPath orders them
    // (ascending optimalMoves, then catalog index) — derive the id rather
    // than hardcode it, so the test survives generated-puzzle appends.
    const firstLabId = nodes[0]?.id;
    render(
      <ExerciseDrawer
        {...baseProps}
        stars={sixStars}
        totalStars={6}
        onOpenChange={onOpenChange}
        onNavigate={vi.fn()}
        labyrinthNodes={nodes}
        onLabyrinthSelect={onLabyrinthSelect}
      />,
    );
    const row = screen.getByText("Labyrinth 1").closest("button");
    expect(row).toBeEnabled();
    if (row) fireEvent.click(row);
    expect(onLabyrinthSelect).toHaveBeenCalledWith(firstLabId);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("completed lab shows stars and stays tappable for replay", () => {
    const onLabyrinthSelect = vi.fn();
    const nodes = rookLabNodes(sixStars);
    const firstLabId = nodes[0]?.id ?? "";
    render(
      <ExerciseDrawer
        {...baseProps}
        stars={sixStars}
        totalStars={6}
        onNavigate={vi.fn()}
        labyrinthNodes={rookLabNodes(sixStars, { [firstLabId]: 3 })}
        onLabyrinthSelect={onLabyrinthSelect}
      />,
    );
    const row = screen.getByText("Labyrinth 1").closest("button");
    if (row) fireEvent.click(row);
    expect(onLabyrinthSelect).toHaveBeenCalledWith(firstLabId);
  });

  it("without labyrinthNodes the drawer stays exercise-only (legacy)", () => {
    render(<ExerciseDrawer {...baseProps} onNavigate={vi.fn()} />);
    expect(screen.queryByText(/Labyrinth \d/)).not.toBeInTheDocument();
  });

  it("interleaves labyrinths into the exercise list — no separate section (D6)", () => {
    render(
      <ExerciseDrawer
        {...baseProps}
        onNavigate={vi.fn()}
        labyrinthNodes={rookLabNodes(zeros)}
        onLabyrinthSelect={vi.fn()}
      />,
    );
    // Section header is gone — one continuous path.
    expect(screen.queryByText("Labyrinths")).not.toBeInTheDocument();
    // Labyrinth 1 (unlocks at 6★ → after 2 exercises) renders BEFORE
    // the third exercise ("Center to edge", rook-3).
    const texts = screen
      .getAllByRole("button", { hidden: true })
      .map((b) => b.textContent ?? "");
    const labAt = texts.findIndex((t) => t.includes("Labyrinth 1"));
    const thirdExerciseAt = texts.findIndex((t) =>
      t.includes("Center to edge"),
    );
    expect(labAt).toBeGreaterThan(-1);
    expect(thirdExerciseAt).toBeGreaterThan(-1);
    expect(labAt).toBeLessThan(thirdExerciseAt);
  });
});
