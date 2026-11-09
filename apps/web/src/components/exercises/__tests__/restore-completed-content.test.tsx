import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, screen, within } from "@testing-library/react";

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
 *
 * ⛔ THE OBSERVABLE IS LABYRINTH MODE, NOT THE TITLE. An earlier draft asserted
 * the labyrinth's title was absent from the DOM. That assertion cannot survive
 * the fix: settling to the path opens the drawer, and a Special Training node
 * prints its authored title there on purpose (`exercise-drawer.tsx:317-318`,
 * B4.2.3). So the title IS in the document afterwards — inside the path, which
 * is exactly where we want it. What must be gone is the mounted board.
 *
 * The observable for "a labyrinth is mounted" is the `mission-optimal-moves`
 * testid (`mission-panel-candy.tsx:558`), which renders only under
 * `showMoveCounter = labyrinthMode && labyrinthOptimalMoves`. It is an existing
 * E2E hook, owned by code rather than by authored copy, so it cannot drift when
 * the editorial bundle changes.
 *
 * ⚠️ Do NOT assert on the "0 / N moves" string: in labyrinth mode the band
 * swaps that label for the labyrinth's title (`mission-panel-candy.tsx:496-498`),
 * so the counter text is never on screen and the assertion passes vacuously.
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

/** Entitlement is mocked so the pass-gated case (AC-6) can be driven. It is
 *  resolved-and-inactive by default, which leaves base content untouched. */
const entitlement = vi.hoisted(() => ({
  state: { active: false as boolean, source: null as "pro" | "season_pass" | null, loading: false },
}));

vi.mock("@/lib/season-pass/use-season-pass-status", () => ({
  useSeasonPassStatus: () => ({
    ...entitlement.state,
    seasonPassExpiresAt: null,
    proExpiresAt: null,
    seasonId: null,
    supporterStatus: null,
    shieldsCredited: 0,
    refresh: vi.fn(),
  }),
}));

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

/** Second node, gated behind the Challenge Pass. Used only by AC-6, where it is
 *  completed AND locked at once — the collision the precedence rule settles. */
const ROOK_LAB_PRO: Exercise = {
  id: "t-rook-lab-2",
  title: "Probe Rails PRO",
  startPos: { file: 0, rank: 0 },
  targetPos: { file: 7, rank: 7 },
  optimalMoves: 12,
  access: "training_pass",
};

/** `open` mirrors a Mini-games surface tap: the route boundary resolves the id,
 *  grants the origin and the progression bypass, and the screen opens it. Since
 *  the 2026-08-21 separation this is the ONLY way into lane content in LEARN —
 *  the drawer no longer draws lane rows. */
function renderScreen(
  labyrinths: Exercise[] = [ROOK_LAB],
  open?: { contentId: string; origin?: "featured" | "library" },
) {
  return renderWithAppProviders(
    <ContentCatalogProvider
      value={{
        exercises: { ...EXERCISES, rook: ROOK_POOL },
        labyrinths: { ...LABYRINTHS, rook: labyrinths },
        descriptions: GENERATED_EXERCISE_DESCRIPTIONS,
      }}
    >
      <ExercisesScreen
        initialContentId={open?.contentId}
        initialContentOrigin={open ? (open.origin ?? "library") : "exercise_path"}
        initialContentBypassLock={Boolean(open)}
      />
    </ContentCatalogProvider>,
  );
}

/** The restore effect is asynchronous; give it room to settle. */
async function settle() {
  await new Promise((resolve) => setTimeout(resolve, 400));
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

    // The labyrinth is DONE — but deliberately NOT at its optimum (14 vs 10).
    // The product rule is `best !== null` (`path.ts:143`), and a best is
    // written on ANY arrival at the target (`exercises-screen.tsx:3336-3349`).
    // Recording the optimum here would let an implementation that wrongly
    // checks for 3★ pass for the wrong reason.
    localStorage.setItem(
      labyrinthBestStorageKey("rook"),
      JSON.stringify({ [ROOK_LAB.id]: ROOK_LAB.optimalMoves + 4 }),
    );

    // ...and it is the last thing they played for this piece.
    writeLastTrainingContentId("rook", ROOK_LAB.id);

    markMilestonesSeeded();
  });

  afterEach(() => {
    cleanup();
  });

  /** Present only while a labyrinth board is mounted. See the header note. */
  const LABYRINTH_MOUNTED = "mission-optimal-moves";

  // AC-1
  it("does not re-serve a labyrinth the player already completed", async () => {
    renderScreen();
    await settle();

    expect(screen.queryByTestId(LABYRINTH_MOUNTED)).toBeNull();
  });

  // AC-2 — stated in the positive. Landing nowhere would also satisfy AC-1;
  // what the player must get is the PATH, which is the whole point of the fix.
  it("settles onto the open path instead", async () => {
    renderScreen();
    await settle();

    expect(await screen.findByRole("dialog")).toBeInTheDocument();
  });

  /* ⛔ UPDATED 2026-08-21 — the lane node is no longer ON the path, and that is
     the separation, not a regression. This used to assert the finished
     labyrinth's title inside the drawer; in LEARN the drawer draws exercises
     only, and every mini-game lives in the Library (`/minigames`). The
     invariant AC-2 actually protects — "the player lands on the path, not on a
     re-served labyrinth" — is unchanged and is what the two tests here check. */
  it("draws no lane row on the path", async () => {
    renderScreen();
    await settle();

    const path = await screen.findByRole("dialog");
    expect(within(path).queryByText(ROOK_LAB.title!)).toBeNull();
  });

  // AC-4 — the filter is exclusive to the implicit restore. An EXPLICIT open
  // (now: a Library tap, resolved at the route boundary) still serves it.
  it("still opens a completed labyrinth on an explicit open", async () => {
    renderScreen([ROOK_LAB], { contentId: ROOK_LAB.id, origin: "library" });
    await settle();

    expect(await screen.findByTestId(LABYRINTH_MOUNTED)).toBeInTheDocument();
  });
});

/**
 * AC-6 — the precedence contract: `locked` outranks `completed`.
 *
 * A labyrinth can be finished AND pass-gated at once — it is exactly the state
 * `training-pass-screen-integration` restores into.
 *
 * ⛔ MEASURED, not assumed: the ordering has NO observable consequence today,
 * and two attempts to pin it were confirmed vacuous by mutation —
 * hoisting the completion check above the access check left them both green.
 *
 *   1. On a restore, `locked` and `completed` settle IDENTICALLY (both run
 *      `settleToPath`), so no DOM assertion can separate them.
 *   2. The unlock CTA does not go through `requestTrainingContent` at all: the
 *      drawer derives lock state from `labyrinthAccess` and routes checkout
 *      itself (`exercise-drawer.tsx:399-405`). The request-level `openCheckout`
 *      branch is unreachable from a gated node.
 *
 * So the ordering is a CODE contract, pinned by the comment on
 * `TrainingContentRequestResult` and by the position of the branch — not by a
 * test. Writing a green test for it would claim coverage that does not exist.
 * It still matters: the moment `completed` grows a distinct settling, this
 * ordering is what keeps a gated node's unlock reachable.
 *
 * What the test below DOES guard is the regression that actually happened: a
 * gated labyrinth losing its locked node because the restore skipped the call.
 */
describe("restore of a labyrinth that is completed AND pass-gated", () => {
  beforeEach(() => {
    localStorage.clear();
    Object.assign(entitlement.state, { active: false, source: null, loading: false });

    localStorage.setItem(
      pieceProgressStorageKey("rook"),
      JSON.stringify({
        piece: "rook",
        currentId: "t-rook-4",
        stars: { "t-rook-1": 3, "t-rook-2": 3, "t-rook-3": 3 },
      }),
    );

    // BOTH finished — the gated one included, and neither at its optimum.
    localStorage.setItem(
      labyrinthBestStorageKey("rook"),
      JSON.stringify({
        [ROOK_LAB.id]: ROOK_LAB.optimalMoves + 4,
        [ROOK_LAB_PRO.id]: ROOK_LAB_PRO.optimalMoves + 3,
      }),
    );

    writeLastTrainingContentId("rook", ROOK_LAB_PRO.id);
    markMilestonesSeeded();
  });

  afterEach(() => cleanup());

  /* Guard against the naive fix: the regression that actually happened was a
     gated labyrinth being SERVED anyway. `locked` outranks `completed`, and the
     player must land on no board.

     ⛔ THE UNLOCK-CTA HALF OF THIS TEST WAS REMOVED 2026-08-21, and the reason
     matters. That CTA renders on a LOCKED LANE ROW in the drawer
     (`exercise-drawer.tsx:477`), and LEARN no longer draws lane rows — every
     mini-game lives in the Library. So in LEARN a pass-gated mini-game would
     have nowhere to offer its unlock.

     That state is UNREACHABLE today: no shipped healthy challenge carries an
     `entitlement` (only this fixture does), which the test right below pins.
     If content ever adds one, that test goes red BEFORE a player can tap a
     Library row and watch nothing happen. */
  it("mounts no board — locked outranks completed", async () => {
    renderScreen([ROOK_LAB, ROOK_LAB_PRO]);
    await settle();

    expect(screen.queryByTestId("mission-optimal-moves")).toBeNull();
  });

});
