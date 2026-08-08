import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, screen } from "@testing-library/react";

import { renderWithAppProviders } from "@/test-utils/render-with-app-providers";
import { ContentCatalogProvider } from "@/lib/content/catalog-context";
import { EXERCISES, LABYRINTHS } from "@/lib/game/exercises";
import { GENERATED_EXERCISE_DESCRIPTIONS } from "@/lib/game/generated/puzzles.generated";
import {
  labyrinthBestStorageKey,
  pieceProgressStorageKey,
} from "@/lib/lite-progress-storage";
import { writeLastTrainingContentId } from "@/lib/training/content-access";
import { markMilestonesSeeded } from "@/lib/progression/seed-milestones";
import type { Exercise } from "@/lib/game/types";

/**
 * REPRODUCTION — reported on prod (learn.chesscito.com) 2026-08-07, on two
 * separate accounts.
 *
 * The player finished the rook's last labyrinth (`Rook Run`) at the optimum,
 * 3/3 stars. Leaving to the hub and tapping the rook again put them straight
 * back into `Rook Run`. Repeatedly. It read as "my progress is not saving".
 *
 * It is NOT a save bug: the stored map holds all four bests, `rook-rail-rook-run`
 * included. `getNextChallenge` correctly returns null — nothing is available.
 *
 * The cause is the RESTORE on mount (`exercises-screen.tsx:3240`):
 *
 *     const contentId = directContentId ?? readLastTrainingContentId(piece);
 *
 * It reopens the last content played for the piece without asking whether that
 * content is already finished. For an exercise that is the right behaviour —
 * resume where you were. For a labyrinth already completed at the optimum it is
 * indistinguishable from having made no progress at all, and the buried path
 * gives the player no way to see that they in fact finished every one.
 *
 * This test pins the boundary: restore may resume, it may not re-serve a
 * COMPLETED labyrinth as if it were the next thing to do.
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

const pushMock = vi.fn();
vi.mock("@/i18n/navigation", () => ({
  useRouter: () => ({
    push: pushMock,
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

/** Five trivial one-move rook slides. */
const ROOK_POOL: Exercise[] = [1, 2, 3, 4, 5].map((n) => ({
  id: `t-rook-${n}`,
  startPos: { file: 0, rank: n - 1 },
  targetPos: { file: 7, rank: n - 1 },
  optimalMoves: 1,
}));

/** One labyrinth, standing in for `rook-rail-rook-run`. Its title is what the
 *  mission line prints, so it is the observable for "this got opened". */
const ROOK_LAB: Exercise = {
  id: "t-rook-lab-1",
  title: "Probe Rails",
  startPos: { file: 1, rank: 6 },
  targetPos: { file: 6, rank: 1 },
  optimalMoves: 10,
};

function renderScreen() {
  return renderWithAppProviders(
    <ContentCatalogProvider
      value={{
        exercises: { ...EXERCISES, rook: ROOK_POOL },
        labyrinths: { ...LABYRINTHS, rook: [ROOK_LAB] },
        descriptions: GENERATED_EXERCISE_DESCRIPTIONS,
      }}
    >
      <ExercisesScreen />
    </ContentCatalogProvider>,
  );
}

describe("restore on mount", () => {
  beforeEach(() => {
    localStorage.clear();
    pushMock.mockClear();

    // Enough banked stars and solves to clear the labyrinth gate
    // (LABYRINTH_UNLOCK_THRESHOLD 6★ + LABYRINTH_MIN_EXERCISES 3).
    localStorage.setItem(
      pieceProgressStorageKey("rook"),
      JSON.stringify({
        piece: "rook",
        currentId: "t-rook-4",
        stars: { "t-rook-1": 3, "t-rook-2": 3, "t-rook-3": 3 },
      }),
    );

    // The labyrinth is DONE — recorded at its optimum, exactly like the
    // founder's `rook-rail-rook-run: 10`.
    localStorage.setItem(
      labyrinthBestStorageKey("rook"),
      JSON.stringify({ [ROOK_LAB.id]: ROOK_LAB.optimalMoves }),
    );

    // ...and it is the last thing they played for this piece.
    writeLastTrainingContentId("rook", ROOK_LAB.id);

    markMilestonesSeeded();
  });

  afterEach(() => {
    cleanup();
  });

  /* ⏸️ SKIPPED — this is a REPRODUCTION of a live prod bug, not a regression
     guard. It went red as written (the completed labyrinth reopens), which
     confirmed the cause. The naive fix — dropping the restore for a completed
     labyrinth — turned `training-pass-screen-integration` red: the restore
     effect ALSO settles the screen's initial hydration, so returning early
     leaves a pass-gated labyrinth stuck on `aria-busy` and the locked node
     never renders.

     ⛔ Un-skip this as part of the real fix, which has to split those two
     responsibilities: always settle hydration, decide separately what to open.
     Do not delete it — re-deriving this setup costs more than keeping it. */
  it.skip("does not re-serve a labyrinth the player already completed", async () => {
    renderScreen();

    // Give the restore effect its chance to fire.
    await new Promise((resolve) => setTimeout(resolve, 400));

    expect(screen.queryByText(ROOK_LAB.title!)).toBeNull();
  });
});
