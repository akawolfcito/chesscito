import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";

import { renderWithAppProviders } from "@/test-utils/render-with-app-providers";
import { ContentCatalogProvider } from "@/lib/content/catalog-context";
import { EXERCISES, LABYRINTHS } from "@/lib/game/exercises";
import { GENERATED_EXERCISE_DESCRIPTIONS } from "@/lib/game/generated/puzzles.generated";
import { dailyProgressStorageKey, milestoneStorageKey } from "@/lib/lite-progress-storage";
import { markMilestonesSeeded } from "@/lib/progression/seed-milestones";
import { STREAK_NUDGE_COPY } from "@/lib/content/editorial";
import { getStreakNudgeState } from "@/lib/daily/streak-nudge";
import type { Exercise } from "@/lib/game/types";

/**
 * The daily-streak nudge, composed with the screen it lives in.
 *
 * The unit tests prove the latch. Only a screen-level test proves the two
 * claims the spec actually makes about the PLAYER's experience: that the 3rd
 * victory (the busiest celebration instant in LEARN) stays free of it, and
 * that the exit which summoned it still happens afterwards.
 *
 * Harness conventions borrowed from `celebration-order.test.tsx`.
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
    isStreakNudgeEnabled: () => true,
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

/** Trivial one-move rook slides, so every solve is a clean 3 star result. */
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

function solve(exercise: Exercise) {
  const from = `Square ${String.fromCharCode(97 + exercise.startPos.file)}${exercise.startPos.rank + 1}`;
  const to = `Square ${String.fromCharCode(97 + exercise.targetPos.file)}${exercise.targetPos.rank + 1}`;
  fireEvent.click(screen.getByRole("gridcell", { name: from }));
  fireEvent.click(screen.getByRole("gridcell", { name: to }));
}

async function tapPastWellDone() {
  await screen.findByText("Tap to Continue", undefined, { timeout: 2500 });
  fireEvent.click(screen.getByRole("button", { name: "Tap to Continue" }));
  await waitFor(() => {
    expect(screen.queryByText("Tap to Continue")).not.toBeInTheDocument();
  });
}

/** Clears whatever recognition took the stage, so the next solve can run. */
async function clearAnyOverlay() {
  const closers = screen.queryAllByRole("button", { name: /continue|close|next/i });
  if (closers.length > 0) {
    fireEvent.click(closers[0]);
    await waitFor(() => {
      expect(document.querySelectorAll('[aria-modal="true"]')).toHaveLength(0);
    });
  }
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Every milestone already earned AND celebrated: this test is about the
 *  nudge, and a crowded queue would be measuring something else. */
function seedAllCelebrated() {
  const now = new Date().toISOString();
  const events: Record<string, unknown> = {};
  for (const key of [
    "first-reward",
    "great-focus-session",
    "first-great-session",
    "first-solve",
  ]) {
    events[key] = { id: key, earnedAt: now, celebratedAt: now };
  }
  localStorage.setItem(
    milestoneStorageKey(),
    JSON.stringify({ version: 1, events, dailyDate: today() }),
  );
}

function nudgeIsOnScreen(): boolean {
  return screen.queryByText(STREAK_NUDGE_COPY.title) !== null;
}

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem("chesscito:onboarded", "true");
  markMilestonesSeeded();
  seedAllCelebrated();
  pushMock.mockClear();
});

afterEach(() => {
  cleanup();
});

describe("daily-streak nudge on the exercises screen", () => {
  it("stays off the screen through all three solves, then pays on the way out", async () => {
    renderScreen();

    for (const exercise of ROOK_POOL.slice(0, 3)) {
      solve(exercise);
      await tapPastWellDone();
      expect(nudgeIsOnScreen()).toBe(false);
      await clearAnyOverlay();
    }

    // Armed but silent: the latch is owed and nothing has rendered.
    expect(getStreakNudgeState().owedForDate).toBe(today());
    expect(nudgeIsOnScreen()).toBe(false);

    fireEvent.click(screen.getByRole("button", { name: "Back to hub" }));

    await waitFor(() => expect(nudgeIsOnScreen()).toBe(true));
    // The exit is DEFERRED, not cancelled.
    expect(pushMock).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: STREAK_NUDGE_COPY.closeLabel }));

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/"));
    expect(nudgeIsOnScreen()).toBe(false);
    expect(getStreakNudgeState().shownCount).toBe(1);
  }, 20000);

  it("never appears to a player who already solved today's Daily", async () => {
    localStorage.setItem(
      dailyProgressStorageKey(),
      JSON.stringify({ streak: 1, lastCompletedDate: today(), totalCompleted: 1 }),
    );
    renderScreen();

    for (const exercise of ROOK_POOL.slice(0, 3)) {
      solve(exercise);
      await tapPastWellDone();
      await clearAnyOverlay();
    }

    fireEvent.click(screen.getByRole("button", { name: "Back to hub" }));

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/"));
    expect(nudgeIsOnScreen()).toBe(false);
    // Three full solve ceremonies in jsdom: slow by nature, not flaky. The
    // default 5s clears in isolation and does not under full-suite load.
  }, 20000);
});
