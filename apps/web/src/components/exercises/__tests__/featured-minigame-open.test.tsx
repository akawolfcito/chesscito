import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";

import { renderWithAppProviders } from "@/test-utils/render-with-app-providers";
import { ContentCatalogProvider } from "@/lib/content/catalog-context";
import { EXERCISES, LABYRINTHS } from "@/lib/game/exercises";
import { GENERATED_EXERCISE_DESCRIPTIONS } from "@/lib/game/generated/puzzles.generated";
import { pieceProgressStorageKey } from "@/lib/lite-progress-storage";
import { markMilestonesSeeded } from "@/lib/progression/seed-milestones";
import type { Exercise } from "@/lib/game/types";

/**
 * AC-4 + AC-5 as END-TO-END behaviour, not as a pure-function claim.
 *
 * A featured Mini-games card points at whatever level the author curated —
 * `rook-rail-two-roads` is level 4 of the rook lane — and the audience the
 * surface exists to reach has zero rook stars and no badge claim. If the lane's
 * progression lock still applied, every card would bounce straight back to the
 * path and the whole slice would ship as a dead surface.
 *
 * The observable is the MOUNTED BOARD, never a title: settling to the path
 * opens the drawer, which prints a Special Training node's authored title on
 * purpose. `mission-optimal-moves` renders only under
 * `labyrinthMode && labyrinthOptimalMoves` (mission-panel-candy.tsx), so it is
 * the honest answer to "is a mini-game actually open?" — and it is a code-owned
 * testid, so editorial edits cannot drift it.
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

const entitlement = vi.hoisted(() => ({
  state: {
    active: false as boolean,
    source: null as "pro" | "season_pass" | null,
    loading: false,
  },
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

const ROOK_POOL: Exercise[] = [1, 2, 3, 4, 5].map((n) => ({
  id: `t-rook-${n}`,
  startPos: { file: 0, rank: n - 1 },
  targetPos: { file: 7, rank: n - 1 },
  optimalMoves: 1,
}));

/** Two chained lane levels. `LATER` is the mid-lane level a rotation features:
 *  it is locked until `FIRST` is complete, and the player has completed
 *  nothing. */
const FIRST: Exercise = {
  id: "t-lane-1",
  title: "Probe One",
  startPos: { file: 1, rank: 6 },
  targetPos: { file: 6, rank: 1 },
  optimalMoves: 10,
};
const LATER: Exercise = {
  id: "t-lane-2",
  title: "Probe Two",
  startPos: { file: 0, rank: 0 },
  targetPos: { file: 7, rank: 7 },
  optimalMoves: 12,
};
const LATER_PASS_GATED: Exercise = { ...LATER, id: "t-lane-3", access: "training_pass" };

function renderScreen(args: {
  contentId: string;
  featured: boolean;
  lane?: Exercise[];
}) {
  return renderWithAppProviders(
    <ContentCatalogProvider
      value={{
        exercises: { ...EXERCISES, rook: ROOK_POOL },
        labyrinths: { ...LABYRINTHS, rook: args.lane ?? [FIRST, LATER] },
        descriptions: GENERATED_EXERCISE_DESCRIPTIONS,
      }}
    >
      <ExercisesScreen
        initialContentId={args.contentId}
        initialContentOrigin={args.featured ? "featured" : "exercise_path"}
        initialContentBypassLock={args.featured}
      />
    </ContentCatalogProvider>,
  );
}

/**
 * ⛔ EVERY ASSERTION IN THIS FILE MUST GO THROUGH THIS.
 *
 * `useSplashLoader` holds a full-screen `playhub-intro-overlay` until an image
 * preload resolves, and while it is up the whole mission shell is `aria-hidden`
 * and the board is not mounted. A negative assertion made during the splash
 * passes for the wrong reason — it would report "the gate held" when the truth
 * is "nothing had rendered yet".
 *
 * So: wait for the splash to be GONE, then assert. The positive and the
 * negative cases then measure the same moment.
 */
/** Enough banked stars and solves to clear the lane gate
 *  (LABYRINTH_UNLOCK_THRESHOLD 6★ + LABYRINTH_MIN_EXERCISES 3).
 *  ⚠️ `markMilestonesSeeded` runs AFTER the write: the seed snapshots what has
 *  already been celebrated, so seeding first makes these 9 stars look freshly
 *  earned and the milestone machine covers the board with its celebration. */
function seedRookProgress() {
  localStorage.setItem(
    pieceProgressStorageKey("rook"),
    JSON.stringify({
      piece: "rook",
      currentId: null,
      stars: { "t-rook-1": 3, "t-rook-2": 3, "t-rook-3": 3 },
    }),
  );
  markMilestonesSeeded();
}

async function settledBoard(): Promise<HTMLElement | null> {
  await waitFor(
    () => {
      expect(document.querySelector(".playhub-intro-overlay")).toBeNull();
    },
    { timeout: 5000 },
  );
  // The request boundary settles in an effect after the splash clears.
  await new Promise((resolve) => setTimeout(resolve, 400));
  return screen.queryByTestId("mission-optimal-moves");
}

describe("featured mini-game deep link (AC-4 / AC-5)", () => {
  beforeEach(() => {
    localStorage.clear();
    entitlement.state.active = false;
    entitlement.state.loading = false;
    // Without this the milestone machine queues its intro celebration over the
    // board, and every observable below hides behind it.
    markMilestonesSeeded();
  });

  /** The state the whole slice targets: no stars, no completions, no badge —
   *  a player who has never touched this piece — opening a curated mid-lane
   *  challenge. */
  it("opens a locked mid-lane challenge for a player with NO progress at all", async () => {
    renderScreen({ contentId: LATER.id, featured: true });
    expect(await settledBoard()).toBeInTheDocument();
  });

  /** The control. Same id, same empty progress, `featured` absent → the lane's
   *  own lock applies and the request settles to the path. This is what proves
   *  the bypass is doing the work, and that a bare deep link did not silently
   *  become open too. */
  it("does NOT open the same locked challenge without the featured flag", async () => {
    renderScreen({ contentId: LATER.id, featured: false });
    expect(await settledBoard()).toBeNull();
  });

  /** The returning player — the one H1.5 is about. Progress on record, so the
   *  path hydrates across renders rather than on the first one, and the card
   *  must STILL open. This is the case that would have shipped a dead surface
   *  for everyone who already plays. */
  it("opens a featured challenge for a RETURNING player with progress on record", async () => {
    seedRookProgress();
    renderScreen({ contentId: LATER.id, featured: true });
    expect(await settledBoard()).toBeInTheDocument();
  });

  /* ⛔ PRE-EXISTING DEFECT, NOT INTRODUCED BY THIS SLICE — deliberately not
     asserted, because asserting today's behaviour would freeze the bug in.

     A plain `?content=<id>` deep link to a lane level that IS available can be
     DROPPED when the player has stored progress. `useExerciseProgress` hydrates
     from localStorage in an effect, so the restore effect's first run sees an
     empty progress map, `meetsFirstLabGate` is false, the node reads `locked`,
     the request settles to the path — and the outer effect then clears
     `initialContentRequestRef`, so it is never retried after hydration lands.

     Verified adjacent to this file: the same scenario with `featured: true`
     OPENS (the test above), because the featured source skips exactly the lock
     that the un-hydrated path reports. So the Mini-games surface is unaffected;
     what is affected is any hand-typed or shared `?content=` URL.

     Out of scope here: fixing it means changing when the restore effect
     consumes its request, which is the boundary `restore-completed-content.test.tsx`
     pins. Reported in the slice deliverable. */
  it.todo(
    "a bare ?content= deep link should survive progress hydration (pre-existing race)",
  );

  /** ⛔ The line Early Access must not cross. `featured` skips PROGRESSION,
   *  never the commercial gate — a hub card cannot hand out pass-gated content
   *  for free. */
  it("refuses pass-gated content even when featured", async () => {
    renderScreen({
      contentId: LATER_PASS_GATED.id,
      featured: true,
      lane: [FIRST, LATER_PASS_GATED],
    });
    expect(await settledBoard()).toBeNull();
  });

  /** A featured id that is not in the lane at all is still nothing. The bypass
   *  loosens a lock; it does not invent content. */
  it("refuses an id that does not exist in the lane", async () => {
    renderScreen({ contentId: "t-lane-nonexistent", featured: true });
    expect(await settledBoard()).toBeNull();
  });
});
