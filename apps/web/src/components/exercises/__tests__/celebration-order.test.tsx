import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, screen } from "@testing-library/react";

import { renderWithAppProviders } from "@/test-utils/render-with-app-providers";
import { ContentCatalogProvider } from "@/lib/content/catalog-context";
import { EXERCISES, LABYRINTHS } from "@/lib/game/exercises";
import { GENERATED_EXERCISE_DESCRIPTIONS } from "@/lib/game/generated/puzzles.generated";
import {
  dailySessionStorageKey,
  pieceProgressStorageKey,
} from "@/lib/lite-progress-storage";
import { getWelcomePackageState } from "@/lib/welcome-package/storage";
import type { Exercise } from "@/lib/game/types";

/**
 * Task 13 — THE inversion this cluster exists to fix.
 *
 * The evaluation order is the contract:
 *   1. record the activity → 2. evaluate milestones → 3. persist →
 *   4. build + drain the queue → 5. render → 6. return to the experience →
 *   7. ONLY THEN, on the next start, evaluate the session limit.
 *
 * The session limit must never be consulted while a recognition is pending.
 * The player who struggles, retries, and burns the daily quota gets the
 * CELEBRATION, not the paywall.
 *
 * Harness conventions borrowed from `daily-tactic-slot-unbundle.test.tsx`
 * (feature-flags mocked Lite ON, gridcell clicks to solve) and
 * `arena-play-mode-dock-destinations.test.tsx` (`@/i18n/navigation` mock).
 * The exercise pool is injected through `ContentCatalogProvider` so every
 * solve is a deterministic single rook slide worth exactly 3 stars.
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

const { ExercisesScreen } = await import("../exercises-screen");

/** Five trivial one-move rook slides. `optimalMoves: 1` → every solve is a
 *  clean 3★, so the star arithmetic in the assertions is exact. */
const ROOK_POOL: Exercise[] = [1, 2, 3, 4, 5].map((n) => ({
  id: `t-rook-${n}`,
  startPos: { file: 0, rank: n - 1 },
  targetPos: { file: 7, rank: n - 1 },
  optimalMoves: 1,
}));

function renderScreen() {
  return renderWithAppProviders(
    <ContentCatalogProvider
      value={{
        exercises: { ...EXERCISES, rook: ROOK_POOL },
        labyrinths: { ...LABYRINTHS, rook: [] },
        descriptions: GENERATED_EXERCISE_DESCRIPTIONS,
      }}
    >
      <ExercisesScreen />
    </ContentCatalogProvider>,
  );
}

/** Drives the board exactly like a player: tap the rook, tap the target. */
function solve(exercise: Exercise) {
  const from = `Square ${String.fromCharCode(97 + exercise.startPos.file)}${exercise.startPos.rank + 1}`;
  const to = `Square ${String.fromCharCode(97 + exercise.targetPos.file)}${exercise.targetPos.rank + 1}`;
  fireEvent.click(screen.getByRole("gridcell", { name: from }));
  fireEvent.click(screen.getByRole("gridcell", { name: to }));
}

function seedRookProgress(currentId: string, stars: Record<string, number>) {
  localStorage.setItem(
    pieceProgressStorageKey("rook"),
    JSON.stringify({ piece: "rook", currentId, stars }),
  );
}

/** Burns the free daily quota (10 slots) on unrelated content. */
function exhaustSessionQuota() {
  localStorage.setItem(
    dailySessionStorageKey(),
    JSON.stringify({
      date: new Date().toISOString().slice(0, 10),
      consumedContentIds: Array.from(
        { length: 10 },
        (_, i) => `exercise:bishop:spent-${i}`,
      ),
      paidUnlocked: 0,
    }),
  );
}

beforeEach(() => {
  localStorage.clear();
  // Skip the first-visit mission briefing so the board is the only surface.
  localStorage.setItem("chesscito:onboarded", "true");
  pushMock.mockClear();
});

afterEach(() => {
  cleanup();
});

describe("celebration order on the exercises screen", () => {
  it("never shows the session limit while a recognition is pending", () => {
    exhaustSessionQuota();
    renderScreen();

    // Pre-state: the quota is spent, so the limit card owns the screen.
    expect(screen.getByText("Great focus today!")).toBeInTheDocument();

    // A fresh solve with the quota already burned: the session ended, so the
    // Great Focus Session fires.
    solve(ROOK_POOL[0]);

    expect(screen.getByText("Great Focus Session")).toBeInTheDocument();
    expect(screen.queryByText("Great focus today!")).not.toBeInTheDocument();
  });

  it("shows the gift overlay before the maze overlay, never stacked", () => {
    // 6★ across 2 exercises already; the third solve crosses BOTH the gift
    // gate (4★ / 2 exercises) and the maze gate (6★ / 3 exercises) at once.
    seedRookProgress("t-rook-3", { "t-rook-1": 3, "t-rook-2": 3 });
    renderScreen();

    solve(ROOK_POOL[2]);

    expect(screen.getAllByRole("dialog")).toHaveLength(1);
    expect(screen.getByText("First Reward Earned")).toBeInTheDocument();
    expect(screen.queryByText("First Maze Unlocked")).not.toBeInTheDocument();
  });

  it("makes the gift claimable when first-reward fires", () => {
    seedRookProgress("t-rook-3", { "t-rook-1": 3, "t-rook-2": 3 });
    expect(getWelcomePackageState().unlocked).toBe(false);

    renderScreen();
    solve(ROOK_POOL[2]);

    // Rendering an overlay is not the gift. The shop/hub tile gates on
    // `unlocked && !claimed` — without this write the gift is unreachable
    // forever and the celebration is a lie.
    expect(getWelcomePackageState().unlocked).toBe(true);
    expect(getWelcomePackageState().claimed).toBe(false);
  });
});
