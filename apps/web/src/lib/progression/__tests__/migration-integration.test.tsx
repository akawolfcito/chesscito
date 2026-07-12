import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, screen, waitFor } from "@testing-library/react";

import { renderWithAppProviders } from "@/test-utils/render-with-app-providers";
import { ContentCatalogProvider } from "@/lib/content/catalog-context";
import { EXERCISES, LABYRINTHS } from "@/lib/game/exercises";
import { GENERATED_EXERCISE_DESCRIPTIONS } from "@/lib/game/generated/puzzles.generated";
import {
  labyrinthBestStorageKey,
  pieceProgressStorageKey,
} from "@/lib/lite-progress-storage";
import { getMilestoneStore } from "@/lib/progression/milestone-storage";
import { hasSeededMilestones } from "@/lib/progression/seed-milestones";
import { setWelcomePackageState, DEFAULT_STATE } from "@/lib/welcome-package/storage";
import type { Exercise } from "@/lib/game/types";

/**
 * Task 15 — THE migration.
 *
 * `seedExistingPlayer` was fully built, fully tested and had ZERO production
 * callers. Task 13 wired the celebration queue into the exercises screen, so
 * until this ran, a veteran player's very FIRST solve resolved against their
 * entire history and fired a parade of overlays for milestones they passed
 * months ago.
 *
 * The invariant proved here: a returning player sees ZERO dialogs on first
 * launch after the upgrade, on EVERY path — including the one that skips the
 * hub entirely and deep-links straight to `/exercises`.
 *
 * Harness conventions borrowed from `components/exercises/__tests__/
 * celebration-order.test.tsx`.
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

const { ExercisesScreen } = await import("@/components/exercises/exercises-screen");
const { LearnHubClient } = await import("@/components/hub/learn-hub-client");

/** Five trivial one-move rook slides — every solve is a clean 3★. */
const ROOK_POOL: Exercise[] = [1, 2, 3, 4, 5].map((n) => ({
  id: `t-rook-${n}`,
  startPos: { file: 0, rank: n - 1 },
  targetPos: { file: 7, rank: n - 1 },
  optimalMoves: 1,
}));

const ROOK_LAB: Exercise = {
  id: "t-lab-1",
  startPos: { file: 3, rank: 0 },
  targetPos: { file: 3, rank: 7 },
  optimalMoves: 1,
  obstacles: [],
};

function renderExercises() {
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

function renderHub() {
  return renderWithAppProviders(<LearnHubClient />);
}

/** Every celebration overlay is a `VictoryPopupShell` with `aria-modal="true"`.
 *  Some pass `role="alert"` (the labyrinth score card) instead of
 *  `role="dialog"`, so counting by role alone would miss a stacked popup. */
function modalCount(): number {
  return document.querySelectorAll('[aria-modal="true"]').length;
}

function seedPieceStars(piece: "rook" | "bishop", stars: Record<string, number>) {
  localStorage.setItem(
    pieceProgressStorageKey(piece),
    JSON.stringify({ piece, currentId: null, stars }),
  );
}

/**
 * A player from BEFORE the milestone machine existed: 14 rook stars over five
 * exercises, every labyrinth solved, the welcome gift claimed. Their profile
 * has raw progress on disk and an EMPTY milestone store — every gate in the
 * ladder is already behind them.
 */
function seedLegacyProgress() {
  seedPieceStars("rook", {
    "t-rook-1": 3,
    "t-rook-2": 3,
    "t-rook-3": 3,
    "t-rook-4": 3,
    "t-rook-5": 2,
  });
  localStorage.setItem(
    labyrinthBestStorageKey("rook"),
    JSON.stringify({ [ROOK_LAB.id]: 1 }),
  );
  setWelcomePackageState({
    ...DEFAULT_STATE,
    unlocked: true,
    unlockedAt: "2026-01-01T00:00:00.000Z",
    claimed: true,
    claimedAt: "2026-01-01T00:00:00.000Z",
  });
}

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem("chesscito:onboarded", "true");
  pushMock.mockClear();
});

afterEach(() => {
  cleanup();
});

describe("the milestone migration runs for a returning player", () => {
  it("seeds every already-passed milestone on hub mount, with no overlay", async () => {
    seedLegacyProgress();
    renderHub();

    await waitFor(() => {
      expect(hasSeededMilestones()).toBe(true);
    });

    const store = getMilestoneStore();
    expect(store.events["first-reward"].celebratedAt).toBeDefined();
    // A claimed gift is also OPENED — no stale NEW dot on a reward the player
    // collected months ago.
    expect(store.events["first-reward"].openedAt).toBeDefined();
    expect(store.events["first-labyrinth:rook"].celebratedAt).toBeDefined();
    expect(store.events["special-training"].celebratedAt).toBeDefined();
    expect(store.events["piece-badge-eligible:rook"].celebratedAt).toBeDefined();

    expect(modalCount()).toBe(0);
  });

  /** THE hazard. `resolve()` lives on the exercises screen, and a player can
   *  deep-link straight to `/exercises` without ever passing through the hub.
   *  Seeding on the hub alone would hand that player the whole parade. */
  it("seeds the player who deep-links straight to /exercises, before resolve() runs", async () => {
    seedLegacyProgress();
    renderExercises();

    await waitFor(() => {
      expect(hasSeededMilestones()).toBe(true);
    });

    const store = getMilestoneStore();
    expect(store.events["first-reward"].celebratedAt).toBeDefined();
    expect(store.events["first-labyrinth:rook"].celebratedAt).toBeDefined();
    expect(store.events["special-training"].celebratedAt).toBeDefined();
    expect(store.events["piece-badge-eligible:rook"].celebratedAt).toBeDefined();

    // The whole point: state preserved, overlay suppressed.
    expect(modalCount()).toBe(0);
    expect(screen.queryByText("First Reward Earned")).not.toBeInTheDocument();
    expect(screen.queryByText("Badge Ready to Claim")).not.toBeInTheDocument();
  });

  /** Today's session is NOT history. A migration that stamped the daily
   *  milestones would silently rob the player of the session they are in. */
  it("never seeds today's session milestones", async () => {
    seedLegacyProgress();
    renderExercises();

    await waitFor(() => {
      expect(hasSeededMilestones()).toBe(true);
    });

    const store = getMilestoneStore();
    expect(store.events["great-focus-session"]).toBeUndefined();
    expect(store.events["first-great-session"]).toBeUndefined();
  });

  /** A brand-new player is stamped as migrated too — the marker means "the
   *  migration ran", not "the player had history". Nothing is celebrated. */
  it("leaves a brand-new player with an empty store", async () => {
    renderExercises();

    await waitFor(() => {
      expect(hasSeededMilestones()).toBe(true);
    });
    expect(getMilestoneStore().events).toEqual({});
    expect(modalCount()).toBe(0);
  });
});
