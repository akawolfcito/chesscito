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
    expect(screen.getByText("Move along the rank")).toBeInTheDocument(); // rook-1
    expect(screen.getByText("The rook is not a bishop")).toBeInTheDocument(); // rook-8
    // Fresh progress → only index 0 unlocked; a later one is path-locked.
    const locked = screen.getByText("Turn the other corner").closest("button"); // rook-5
    expect(locked).toHaveAttribute("data-locked", "true");
  });

  it("navigates by pool index for an unlocked row", () => {
    const onNavigate = vi.fn();
    render(<ExerciseDrawer {...baseProps} onNavigate={onNavigate} />);
    clickRow("Move along the rank"); // rook-1, pool index 0
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
    expect(screen.getByText("The file works both ways")).toBeInTheDocument(); // rook-3
    expect(screen.getByText("Find the shortest route")).toBeInTheDocument(); // rook-6
    expect(screen.getByText("The rook is not a bishop")).toBeInTheDocument(); // rook-8
    // Outside the set → not rendered.
    expect(screen.queryByText("Move along the rank")).not.toBeInTheDocument(); // rook-1
    expect(screen.queryByText("Move along the file")).not.toBeInTheDocument(); // rook-2
  });

  /* Regression (2026-07-09): rotation hid every exercise the player had
   * already solved, so the sheet could show nothing but locked nodes and
   * offered no way to replay finished work. Completed exercises always
   * belong on the path, whether or not today's rotation picked them. */
  it("always renders completed exercises outside today's visible set", () => {
    render(
      <ExerciseDrawer
        {...baseProps}
        stars={starsById(3, 2)} // rook-1, rook-2 completed; neither is in `visible`
        totalStars={5}
        onNavigate={vi.fn()}
        visibleExerciseIds={visible}
      />,
    );
    expect(screen.getByText("Move along the rank")).toBeInTheDocument(); // rook-1
    expect(screen.getByText("Move along the file")).toBeInTheDocument(); // rook-2
    // Unplayed and unrotated stays hidden.
    expect(screen.queryByText("Turn the corner")).not.toBeInTheDocument(); // rook-4
  });

  it("a completed exercise surfaced by the rotation fix is replayable", () => {
    const onNavigate = vi.fn();
    render(
      <ExerciseDrawer
        {...baseProps}
        stars={starsById(3, 2)}
        totalStars={5}
        onNavigate={onNavigate}
        visibleExerciseIds={visible}
      />,
    );
    clickRow("Move along the rank"); // rook-1 → pool index 0
    expect(onNavigate).toHaveBeenCalledWith(0);
  });

  it("visible-set exercises are still gated by the linear senda", () => {
    // rook-8 (pool index 7) is in the visible set but senda still applies:
    // with stars={} maxAllowed=0, so index 7 > 0 → locked.
    render(
      <ExerciseDrawer
        {...baseProps}
        onNavigate={vi.fn()}
        visibleExerciseIds={visible}
      />,
    );
    expect(screen.getByText("The rook is not a bishop").closest("button")).toHaveAttribute("data-locked", "true");
  });

  it("navigates with the REAL pool index, not the visible-slot index", () => {
    const onNavigate = vi.fn();
    // Give enough stars to unlock rook-8 (index 7): need indices 0-6 completed.
    const enoughStars = starsById(3, 3, 3, 3, 3, 3, 3);
    render(
      <ExerciseDrawer
        {...baseProps}
        stars={enoughStars}
        onNavigate={onNavigate}
        visibleExerciseIds={visible}
      />,
    );
    // "The rook is not a bishop" = rook-8 = pool index 7 (the 3rd visible row).
    clickRow("The rook is not a bishop");
    expect(onNavigate).toHaveBeenCalledWith(7);
  });
});

describe("ExerciseDrawer — labyrinth nodes (Slice 3D)", () => {
  const zeros = starsById();
  // rook-1 + rook-2 + rook-3 at 2★ each → 6★ over 3 exercises (the floor —
  // LABYRINTH_MIN_EXERCISES — needs 3+, not the 2 a 3+3 spread would give).
  const sixStars = starsById(2, 2, 2);

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
    expect(
      screen.getByText("Unlocks at 6★ and 3 exercises"),
    ).toBeInTheDocument();
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
    // Labyrinth 1's anchor is floored to LABYRINTH_MIN_EXERCISES (3), not
    // the stars-only ceil(6/3)=2 — so it renders AFTER the third exercise
    // ("The file works both ways", rook-3) and BEFORE the fourth ("Turn the corner",
    // rook-4), never earlier than the floor allows.
    const texts = screen
      .getAllByRole("button", { hidden: true })
      .map((b) => b.textContent ?? "");
    const labAt = texts.findIndex((t) => t.includes("Labyrinth 1"));
    const thirdExerciseAt = texts.findIndex((t) =>
      t.includes("The file works both ways"),
    );
    const fourthExerciseAt = texts.findIndex((t) =>
      t.includes("Turn the corner"),
    );
    expect(labAt).toBeGreaterThan(-1);
    expect(thirdExerciseAt).toBeGreaterThan(-1);
    expect(fourthExerciseAt).toBeGreaterThan(-1);
    expect(labAt).toBeGreaterThan(thirdExerciseAt);
    expect(labAt).toBeLessThan(fourthExerciseAt);
  });
});

describe("ExerciseDrawer — overlay descriptions (db-content)", () => {
  it("renders an overlay description from ContentCatalogProvider over the baseline text", () => {
    // rook-1 resolves to "Move along the rank" from the baseline generated map.
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
    expect(screen.queryByText("Move along the rank")).not.toBeInTheDocument();
  });

  it("falls back to the baseline description with no provider", () => {
    render(<ExerciseDrawer {...baseProps} onNavigate={vi.fn()} />);
    expect(screen.getByText("Move along the rank")).toBeInTheDocument();
  });
});

// ─── B2.3b: Quota soft gate ───────────────────────────────────────────────────

describe("ExerciseDrawer — quotaState (B2.3b soft gate)", () => {
  const rook1Id = EXERCISES.rook[0].id; // "rook-1"
  const rook2Id = EXERCISES.rook[1].id; // "rook-2"
  const rook3Id = EXERCISES.rook[2].id; // "rook-3"

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
    const row = screen.getByText("Move along the rank").closest("button");
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
    const row = screen.getByText("Move along the rank").closest("button");
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
    const row = screen.getByText("Move along the file").closest("button"); // rook-2
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
    const row = screen.getByText("Move along the file").closest("button"); // rook-2
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
    const row = screen.getByText("Move along the rank").closest("button");
    expect(row).toBeEnabled();
  });

  describe("labyrinth quota behavior", () => {
    // 3 exercises at 2★ each → 6★ over 3 exercises, satisfying
    // LABYRINTH_MIN_EXERCISES (a 3+3 spread over only 2 exercises stays
    // path-locked under the floor).
    const sixStars = { [rook1Id]: 2, [rook2Id]: 2, [rook3Id]: 2 };
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
