import { describe, expect, it, vi } from "vitest";
import { fireEvent } from "@testing-library/react";
import { renderWithIntl as render, screen } from "@/test-utils/render-with-intl";
import { ExerciseDrawer } from "../exercise-drawer";
import { EXERCISES, LABYRINTHS } from "@/lib/game/exercises";
import { GENERATED_EXERCISE_DESCRIPTIONS } from "@/lib/game/generated/puzzles.generated";
import { ContentCatalogProvider } from "@/lib/content/catalog-context";
import { buildTrainingPath } from "@/lib/training/path";

/** Resolve a title from the CATALOG, never a literal.
 *  Pinning authored copy here made five tests fail the moment three rook
 *  exercises were re-authored as Star Sweeps — the exercises were fine, the
 *  assertions were not. A test must not break because a builder edited a
 *  string it does not own. */
const titleOf = (id: string): string => {
  const found = EXERCISES.rook.find((e) => e.id === id);
  if (!found?.title) throw new Error(`no authored title for '${id}'`);
  return found.title;
};

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
    expect(screen.getByText(titleOf("rook-1"))).toBeInTheDocument(); // rook-1
    expect(screen.getByText(titleOf("rook-8"))).toBeInTheDocument(); // rook-8
    // Fresh progress → only index 0 unlocked; a later one is path-locked.
    const locked = screen.getByText(titleOf("rook-no-diagonal-1")).closest("button"); // rook-no-diagonal-1
    expect(locked).toHaveAttribute("data-locked", "true");
  });

  it("navigates by pool index for an unlocked row", () => {
    const onNavigate = vi.fn();
    render(<ExerciseDrawer {...baseProps} onNavigate={onNavigate} />);
    clickRow(titleOf("rook-1")); // rook-1, pool index 0
    expect(onNavigate).toHaveBeenCalledWith(0);
  });
});

describe("ExerciseDrawer — rotation (visibleExerciseIds set)", () => {
  /* Three ids that are NOT the first rows, so "only today's set" is a real
   * claim. Deliberately by id and not by index: this set stands for "whatever
   * the rotation picked", which is arbitrary by nature — unlike the canonical
   * FIRST FIVE in the rotation hook's test, which is a position and must be
   * read as one. */
  const visible = new Set(["rook-distance-1", "rook-6", "rook-8"]);

  it("renders ONLY today's visible set", () => {
    render(
      <ExerciseDrawer
        {...baseProps}
        onNavigate={vi.fn()}
        visibleExerciseIds={visible}
      />,
    );
    expect(screen.getByText(titleOf("rook-distance-1"))).toBeInTheDocument(); // rook-distance-1
    expect(screen.getByText(titleOf("rook-6"))).toBeInTheDocument(); // rook-6
    expect(screen.getByText(titleOf("rook-8"))).toBeInTheDocument(); // rook-8
    // Outside the set → not rendered.
    expect(screen.queryByText(titleOf("rook-1"))).not.toBeInTheDocument(); // rook-1
    expect(screen.queryByText(titleOf("rook-2"))).not.toBeInTheDocument(); // rook-2
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
    expect(screen.getByText(titleOf("rook-1"))).toBeInTheDocument(); // rook-1
    expect(screen.getByText(titleOf("rook-2"))).toBeInTheDocument(); // rook-2
    // Unplayed and unrotated stays hidden.
    expect(screen.queryByText(titleOf("rook-4"))).not.toBeInTheDocument(); // rook-4
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
    clickRow(titleOf("rook-1")); // rook-1 → pool index 0
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
    expect(screen.getByText(titleOf("rook-8")).closest("button")).toHaveAttribute("data-locked", "true");
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
    // The claim is "navigates with the REAL pool index, not the visible-slot
    // one": this row is the 3rd VISIBLE, and must report its pool position.
    // Both the title and that position are read from the catalog — pinning
    // either broke when the rook curriculum was reordered (rook-8 moved from
    // slot 8 to slot 7, and the literal title had already drifted once).
    const poolIndex = EXERCISES.rook.findIndex((e) => e.id === "rook-8");
    expect(poolIndex).toBeGreaterThan(2); // not the 3rd row, or the test is vacuous
    clickRow(titleOf("rook-8"));
    expect(onNavigate).toHaveBeenCalledWith(poolIndex);
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
    expect(screen.getByText("Special Training 1")).toBeInTheDocument();
    expect(screen.getByText("Special Training 3")).toBeInTheDocument();
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
    const locked = screen.getByText("Special Training 1").closest("button");
    expect(locked).toHaveAttribute("data-locked", "true");
    if (locked) fireEvent.click(locked);
    expect(onLabyrinthSelect).not.toHaveBeenCalled();
  });

  it("available lab fires onLabyrinthSelect with its id and closes the drawer", () => {
    const onLabyrinthSelect = vi.fn();
    const onOpenChange = vi.fn();
    const nodes = rookLabNodes(sixStars);
    // "Special Training 1" is the first lab node as buildTrainingPath orders them
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
    const row = screen.getByText("Special Training 1").closest("button");
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
    const row = screen.getByText("Special Training 1").closest("button");
    if (row) fireEvent.click(row);
    expect(onLabyrinthSelect).toHaveBeenCalledWith(firstLabId);
  });

  it("without labyrinthNodes the drawer stays exercise-only (legacy)", () => {
    render(<ExerciseDrawer {...baseProps} onNavigate={vi.fn()} />);
    expect(screen.queryByText(/Special Training \d/)).not.toBeInTheDocument();
  });

  /* ── AC-1 (Learn IA separation, 2026-08-19) ─────────────────────────────
   * REPLACES the D6 interleave test, which pinned the opposite contract:
   * "Special Training 1 renders between the 3rd and the 4th exercise".
   *
   * The exercise sequence is now Ex → Ex → Ex → … with NOTHING spliced into
   * it. The lane rows are not deleted — only 3 of the 13 healthy challenges
   * are featured on the Learn Home surface at a time, so removing them here
   * would orphan the other 10 — they move to the END of the path.
   */
  it("AC-1: no labyrinth splits the exercise sequence — every lane row comes after every exercise", () => {
    render(
      <ExerciseDrawer
        {...baseProps}
        onNavigate={vi.fn()}
        labyrinthNodes={rookLabNodes(zeros)}
        onLabyrinthSelect={vi.fn()}
      />,
    );
    const texts = screen
      .getAllByRole("button", { hidden: true })
      .map((b) => b.textContent ?? "");

    const exercisePositions = EXERCISES.rook
      .map((ex) => texts.findIndex((t) => ex.title && t.includes(ex.title)))
      .filter((position) => position > -1);
    const labPositions = texts
      .map((t, index) => (/Special Training \d/.test(t) ? index : -1))
      .filter((position) => position > -1);

    expect(exercisePositions.length).toBeGreaterThan(0);
    expect(labPositions.length).toBeGreaterThan(0);
    // The separation, stated as the only thing that matters: the LAST exercise
    // row precedes the FIRST lane row. Nothing is interleaved.
    expect(Math.max(...exercisePositions)).toBeLessThan(Math.min(...labPositions));
  });

  it("AC-1: the lane rows are still REACHABLE — separation is not deletion", () => {
    const onLabyrinthSelect = vi.fn();
    const nodes = rookLabNodes(sixStars);
    render(
      <ExerciseDrawer
        {...baseProps}
        stars={sixStars}
        totalStars={6}
        onNavigate={vi.fn()}
        labyrinthNodes={nodes}
        onLabyrinthSelect={onLabyrinthSelect}
      />,
    );
    expect(screen.getAllByText(/Special Training \d/)).toHaveLength(nodes.length);
    const row = screen.getByText("Special Training 1").closest("button");
    if (row) fireEvent.click(row);
    expect(onLabyrinthSelect).toHaveBeenCalledWith(nodes[0]?.id);
  });

  /** AC-3: the drawer's row ORDER changed; the exercise gate did not. Row N is
   *  still locked by its pool index against the linear senda, exactly as before
   *  the lane rows moved. */
  it("AC-3: exercise availability is unchanged by the reorder", () => {
    render(
      <ExerciseDrawer
        {...baseProps}
        onNavigate={vi.fn()}
        labyrinthNodes={rookLabNodes(zeros)}
        onLabyrinthSelect={vi.fn()}
      />,
    );
    const first = screen.getByText(titleOf("rook-1")).closest("button");
    const far = screen.getByText(titleOf("rook-4")).closest("button");
    expect(first).not.toHaveAttribute("data-locked", "true");
    expect(far).toHaveAttribute("data-locked", "true");
  });
});

describe("ExerciseDrawer — overlay descriptions (db-content)", () => {
  it("renders an overlay description from ContentCatalogProvider over the baseline text", () => {
    // rook-1 resolves to titleOf("rook-1") from the baseline generated map.
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
    expect(screen.queryByText(titleOf("rook-1"))).not.toBeInTheDocument();
  });

  it("falls back to the baseline description with no provider", () => {
    render(<ExerciseDrawer {...baseProps} onNavigate={vi.fn()} />);
    expect(screen.getByText(titleOf("rook-1"))).toBeInTheDocument();
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
    const row = screen.getByText(titleOf("rook-1")).closest("button");
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
    const row = screen.getByText(titleOf("rook-1")).closest("button");
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
    const row = screen.getByText(titleOf("rook-2")).closest("button"); // rook-2
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
    const row = screen.getByText(titleOf("rook-2")).closest("button"); // rook-2
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
    const row = screen.getByText(titleOf("rook-1")).closest("button");
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
      const row = screen.getByText("Special Training 1").closest("button");
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
      const row = screen.getByText("Special Training 1").closest("button");
      expect(row).toBeEnabled();
    });

    /* The quota counts carril 1 and ONLY carril 1: `recordExtraConsumed` is
     * called with `kind:"exercise"` at the single call site that exists, so a
     * `labyrinth:` content id can never appear in `consumedContentIds`.
     *
     * This used to assert the opposite, and the opposite was a bug with no way
     * out: at the limit every unplayed carril-2 node asked for an id that
     * nothing writes, so the whole lane locked for the rest of the day. A lane
     * that costs no quota cannot be gated by quota. */
    it("available labyrinth (not consumed today) stays open at the quota limit", () => {
      const onLabyrinthSelect = vi.fn();
      const nodes = rookLabNodes(sixStars);
      render(
        <ExerciseDrawer
          {...baseProps}
          stars={sixStars}
          totalStars={6}
          onNavigate={vi.fn()}
          labyrinthNodes={nodes}
          onLabyrinthSelect={onLabyrinthSelect}
          quotaState={{ isAtLimit: true, consumedContentIds: [], piece: "rook" }}
        />,
      );
      const row = screen.getByText("Special Training 1").closest("button");
      expect(row).not.toHaveAttribute("data-quota-locked");
      expect(row).toBeEnabled();
      fireEvent.click(row!);
      expect(onLabyrinthSelect).toHaveBeenCalledWith(nodes[0].id);
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
      const row = screen.getByText("Special Training 1").closest("button");
      expect(row).toHaveAttribute("data-locked", "true");
    });
  });
});

/* ── "YOU ARE HERE" MUST SURVIVE COMPLETION ────────────────────────────────
 * Reported from the smoke: with every rook exercise at 3★, tapping a node did
 * "nothing". It was doing exactly what it should — the founder was tapping the
 * node they were ALREADY on, the path closed, and the board underneath was
 * unchanged. Indistinguishable from a hang.
 *
 * The cause was here: the active glow rendered under `isActive && !isDone`, so
 * a player who had finished a piece had NO marker anywhere on the path. Every
 * node looked identical — green, checked, three stars — and "which one am I
 * on?" had no answer on screen.
 *
 * ⛔ Asserted through `data-active`, not the CSS filter string: a glow is a
 * design decision that will get retuned, and a test that pins a drop-shadow
 * breaks on a palette change while saying nothing about the guarantee. */
describe("ExerciseDrawer — the active node is marked even when it is done", () => {
  it("marks the active node when it has NOT been solved", () => {
    render(
      <ExerciseDrawer
        {...baseProps}
        stars={starsById()}
        activeIndex={2}
        onNavigate={vi.fn()}
      />,
    );
    const active = document.querySelectorAll('[data-active="true"]');
    expect(active).toHaveLength(1);
  });

  it("STILL marks it when every exercise is solved — the reported case", () => {
    render(
      <ExerciseDrawer
        {...baseProps}
        stars={starsById(...EXERCISES.rook.map(() => 3))}
        activeIndex={0}
        onNavigate={vi.fn()}
      />,
    );
    const active = document.querySelectorAll('[data-active="true"]');
    expect(active, "a finished piece left the path with no you-are-here").toHaveLength(1);
  });
});
