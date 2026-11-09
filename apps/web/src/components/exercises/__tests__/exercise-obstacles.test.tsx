import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, screen } from "@testing-library/react";

import { renderWithAppProviders } from "@/test-utils/render-with-app-providers";
import { ContentCatalogProvider } from "@/lib/content/catalog-context";
import { EXERCISES, LABYRINTHS } from "@/lib/game/exercises";
import { GENERATED_EXERCISE_DESCRIPTIONS } from "@/lib/game/generated/puzzles.generated";
import { pieceProgressStorageKey } from "@/lib/lite-progress-storage";
import type { Exercise } from "@/lib/game/types";

/**
 * A0 — an exercise's own obstacles must reach the board.
 *
 * `exercises-screen` used to hand the board `activeLabyrinth?.obstacles`, so a
 * plain exercise (where `activeLabyrinth` is null) forwarded `undefined` and the
 * rules layer ran with zero blockers: the rook slid straight through every
 * blocker the catalog declared. 19 shipped exercises across 5 pieces carried
 * obstacles the game silently dropped, and since `computeStars` grants 3★ at
 * `movesUsed <= optimalMoves`, the "hard" half of each piece paid out a free 3★.
 *
 * The Daily Tactic sheet always passed `exercise.obstacles` correctly
 * (`daily-tactic-sheet.tsx`) — the same content blocked there and leaked here,
 * which is what proves this was a wiring bug and not a design choice.
 *
 * Audit: docs/audits/2026-07-13-rook-curriculum-audit.md
 * Plan:  docs/plans/2026-07-13-rook-curriculum-implementation-plan.md (A0)
 */

vi.mock("@/lib/feature-flags", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/feature-flags")>();
  return {
    ...actual,
    CHESSCITO_MODE: "learn" as const,
    CHESSCITO_LITE_MODE: true,
    isLearnMode: () => true,
    isPlayMode: () => false,
    isFullMode: () => false,
  };
});

vi.mock("@/i18n/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    back: vi.fn(),
    refresh: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
  Link: ({ children }: { children: ReactNode }) => <>{children}</>,
  usePathname: () => "/exercises",
  redirect: (path: string) => path,
  getPathname: ({ href }: { href: string }) => href,
}));

class NoopIntersectionObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
  root = null;
  rootMargin = "";
  thresholds: number[] = [];
}
vi.stubGlobal("IntersectionObserver", NoopIntersectionObserver);

const { ExercisesScreen } = await import("../exercises-screen");

/**
 * Rook a1, star on a8, one friendly blocker on a4 — the shape of `rook-6`…`rook-10`.
 * The a-file is shut: a8 is NOT reachable in one move. Optimal is 3
 * (a1 → b1 → b8 → a8). With the obstacle dropped, the rook slid a1 → a8 in one.
 */
const BLOCKED_ROOK: Exercise = {
  id: "t-rook-blocked",
  startPos: { file: 0, rank: 0 }, // a1
  targetPos: { file: 0, rank: 7 }, // a8
  optimalMoves: 3,
  obstacles: [{ file: 0, rank: 3 }], // a4
};

function renderScreen() {
  return renderWithAppProviders(
    <ContentCatalogProvider
      value={{
        exercises: { ...EXERCISES, rook: [BLOCKED_ROOK] },
        labyrinths: { ...LABYRINTHS, rook: [] },
        descriptions: GENERATED_EXERCISE_DESCRIPTIONS,
      }}
    >
      <ExercisesScreen />
    </ContentCatalogProvider>,
  );
}

/** The cell <button> the player taps, addressed the way a11y sees it. */
function cell(square: string): HTMLElement {
  return screen.getByRole("gridcell", { name: `Square ${square}` });
}

/** A square is offered as a move when it carries the highlight modifier. */
function isOffered(square: string): boolean {
  return cell(square).querySelector(".playhub-board-cell.is-highlighted") !== null;
}

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem(
    pieceProgressStorageKey("rook"),
    JSON.stringify({ piece: "rook", currentId: BLOCKED_ROOK.id, stars: {} }),
  );
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("A0 — exercise obstacles reach the board", () => {
  it("stops the rook's ray at its own blocker", () => {
    renderScreen();
    fireEvent.click(cell("a1"));

    // Up the a-file: a2 and a3 are open, and that is where the ray must end.
    expect(isOffered("a2")).toBe(true);
    expect(isOffered("a3")).toBe(true);

    // a4 holds a friendly piece — it blocks, and it is not landable.
    expect(isOffered("a4")).toBe(false);

    // Everything BEHIND the blocker is out of reach. a8 is the target star, and
    // offering it is exactly the bug: it turned a 3-move exercise into a 1-move
    // slide worth a free 3★.
    expect(isOffered("a5")).toBe(false);
    expect(isOffered("a8")).toBe(false);
  });

  it("renders the blocker so the player can see what stops them", () => {
    const { container } = renderScreen();
    // The rule is only honest if the cause is visible: a ray that dies on an
    // empty-looking square reads as a broken board, not as a chess rule.
    //
    // A9 gave it its final form — the player's OWN piece, not the maze's stone
    // wall. What matters here is unchanged: something is there, and the player
    // can see it. (Which form belongs to which surface is pinned in board.test.tsx.)
    expect(
      container.querySelector(".playhub-board-piece-float.is-friendly-blocker"),
    ).toBeInTheDocument();
  });
});
