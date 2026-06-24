import { describe, expect, it, vi } from "vitest";
import { fireEvent } from "@testing-library/react";
import { renderWithIntl as render, screen } from "@/test-utils/render-with-intl";
import { ExerciseDrawer } from "../exercise-drawer";
import { EXERCISES, LABYRINTHS } from "@/lib/game/exercises";
import { GENERATED_EXERCISE_DESCRIPTIONS } from "@/lib/game/generated/puzzles.generated";
import { ContentCatalogProvider } from "@/lib/content/catalog-context";
import { buildTrainingPath } from "@/lib/training/path";

/** Build an id-keyed best-stars map from a positional star count per pool
 *  slot (the legacy fixture shape) so each test keeps expressing intent by
 *  position while the component reads by exerciseId. Sparse: zero entries
 *  are dropped (absent id = not played). */
function starsById(...counts: number[]): Record<string, number> {
  const map: Record<string, number> = {};
  EXERCISES.rook.forEach((ex, i) => {
    if ((counts[i] ?? 0) > 0) map[ex.id] = counts[i];
  });
  return map;
}

const baseProps = {
  open: true,
  onOpenChange: vi.fn(),
  piece: "rook" as const,
  exercises: EXERCISES.rook,
  stars: starsById(),
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
    // Fresh progress → only index 0 unlocked; a later one is path-locked.
    const locked = screen.getByText("Cross capture").closest("button"); // rook-5
    expect(locked).toHaveAttribute("data-locked", "true");
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
  const zeros = starsById();
  const sixStars = starsById(3, 3); // rook-1 + rook-2 at 3★ each → 6★

  function rookLabNodes(
    stars: Record<string, number>,
    bests: Record<string, number> = {},
  ) {
    return buildTrainingPath({
      piece: "rook",
      progress: { piece: "rook", currentId: null, stars },
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
    expect(locked).toHaveAttribute("data-locked", "true");
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

describe("ExerciseDrawer — overlay descriptions (db-content)", () => {
  it("renders an overlay description from ContentCatalogProvider over the baseline text", () => {
    // rook-1 resolves to "Horizontal move" from the baseline generated map.
    // An overlay description for rook-1 must win when the drawer threads the
    // injected descriptions map from context.
    const overlay = {
      exercises: EXERCISES,
      labyrinths: LABYRINTHS,
      descriptions: {
        ...GENERATED_EXERCISE_DESCRIPTIONS,
        "rook-1": "Overlay rook description",
      },
    };
    render(
      <ContentCatalogProvider value={overlay}>
        <ExerciseDrawer {...baseProps} onNavigate={vi.fn()} />
      </ContentCatalogProvider>,
    );
    expect(screen.getByText("Overlay rook description")).toBeInTheDocument();
    expect(screen.queryByText("Horizontal move")).not.toBeInTheDocument();
  });

  it("falls back to the baseline description with no provider", () => {
    render(<ExerciseDrawer {...baseProps} onNavigate={vi.fn()} />);
    expect(screen.getByText("Horizontal move")).toBeInTheDocument();
  });
});

// ─── B2.3b: Quota soft gate ───────────────────────────────────────────────────

describe("ExerciseDrawer — quotaState (B2.3b soft gate)", () => {
  const rook1Id = EXERCISES.rook[0].id; // "rook-1"
  const rook2Id = EXERCISES.rook[1].id; // "rook-2"

  const quotaAtLimit = {
    isAtLimit: true,
    consumedContentIds: [`exercise:rook:${rook1Id}`], // rook-1 consumed today
    piece: "rook",
  };

  it("exercise with stars > 0 is clickable at quota limit", () => {
    const onNavigate = vi.fn();
    render(
      <ExerciseDrawer
        {...baseProps}
        stars={{ [rook1Id]: 3 }} // played with stars
        onNavigate={onNavigate}
        quotaState={quotaAtLimit}
      />,
    );
    const row = screen.getByText("Horizontal move").closest("button");
    expect(row).toBeEnabled();
  });

  it("exercise consumed today (in consumedContentIds, no stars) is clickable at limit", () => {
    const onNavigate = vi.fn();
    // rook-1 in consumedContentIds but stars=0 (e.g. interrupted session)
    render(
      <ExerciseDrawer
        {...baseProps}
        stars={{}} // no stars
        onNavigate={onNavigate}
        quotaState={quotaAtLimit}
      />,
    );
    // rook-1 should be enabled (consumed today)
    const row = screen.getByText("Horizontal move").closest("button");
    expect(row).toBeEnabled();
  });

  it("new exercise (no stars, not consumed today) is quota-locked at limit", () => {
    // rook-2 is not in consumedContentIds, no stars
    render(
      <ExerciseDrawer
        {...baseProps}
        stars={{}}
        onNavigate={vi.fn()}
        quotaState={quotaAtLimit}
      />,
    );
    const row = screen.getByText("Vertical move").closest("button"); // rook-2
    expect(row).toHaveAttribute("data-locked", "true");
  });

  it("new exercise shows quota-locked indicator", () => {
    // rook-1 has stars (path-unlocks rook-2); rook-2 has no stars and is
    // NOT in consumedContentIds → isQuotaLocked=true, data-quota-locked set
    render(
      <ExerciseDrawer
        {...baseProps}
        stars={{ [rook1Id]: 3 }}
        onNavigate={vi.fn()}
        quotaState={quotaAtLimit}
      />,
    );
    const row = screen.getByText("Vertical move").closest("button"); // rook-2
    expect(row).toHaveAttribute("data-quota-locked", "true");
  });

  it("no quotaState prop = no quota gate (backward compatible)", () => {
    render(
      <ExerciseDrawer
        {...baseProps}
        stars={{}}
        onNavigate={vi.fn()}
        // no quotaState
      />,
    );
    // rook-1 (index 0) is always unlocked in legacy mode
    const row = screen.getByText("Horizontal move").closest("button");
    expect(row).toBeEnabled();
  });

  describe("labyrinth quota behavior", () => {
    const sixStars = { [rook1Id]: 3, [rook2Id]: 3 };
    function rookLabNodes(starsMap: Record<string, number>, bests: Record<string, number> = {}) {
      return buildTrainingPath({
        piece: "rook",
        progress: { piece: "rook", currentId: null, stars: starsMap },
        labyrinthBests: bests,
        badgeClaimed: false,
      }).filter((node) => node.kind === "labyrinth");
    }

    it("completed labyrinth is clickable at quota limit", () => {
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
          quotaState={{ isAtLimit: true, consumedContentIds: [], piece: "rook" }}
        />,
      );
      const row = screen.getByText("Labyrinth 1").closest("button");
      expect(row).toBeEnabled();
    });

    it("labyrinth consumed today is clickable at quota limit", () => {
      const onLabyrinthSelect = vi.fn();
      const nodes = rookLabNodes(sixStars);
      const firstLabId = nodes[0]?.id ?? "";
      render(
        <ExerciseDrawer
          {...baseProps}
          stars={sixStars}
          totalStars={6}
          onNavigate={vi.fn()}
          labyrinthNodes={nodes}
          onLabyrinthSelect={onLabyrinthSelect}
          quotaState={{
            isAtLimit: true,
            consumedContentIds: [`labyrinth:rook:${firstLabId}`],
            piece: "rook",
          }}
        />,
      );
      const row = screen.getByText("Labyrinth 1").closest("button");
      expect(row).toBeEnabled();
    });

    it("available labyrinth (not consumed today) is quota-locked at limit", () => {
      const nodes = rookLabNodes(sixStars);
      render(
        <ExerciseDrawer
          {...baseProps}
          stars={sixStars}
          totalStars={6}
          onNavigate={vi.fn()}
          labyrinthNodes={nodes}
          onLabyrinthSelect={vi.fn()}
          quotaState={{ isAtLimit: true, consumedContentIds: [], piece: "rook" }}
        />,
      );
      const row = screen.getByText("Labyrinth 1").closest("button");
      expect(row).toHaveAttribute("data-quota-locked", "true");
    });

    it("path-locked labyrinth stays locked regardless of quota", () => {
      const nodes = rookLabNodes({}); // no stars → first lab is path-locked
      render(
        <ExerciseDrawer
          {...baseProps}
          stars={{}}
          totalStars={0}
          onNavigate={vi.fn()}
          labyrinthNodes={nodes}
          onLabyrinthSelect={vi.fn()}
          // no quotaState — path lock only
        />,
      );
      const row = screen.getByText("Labyrinth 1").closest("button");
      expect(row).toHaveAttribute("data-locked", "true");
    });
  });
});
