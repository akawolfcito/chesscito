import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, screen } from "@testing-library/react";

import { ContentCatalogProvider } from "@/lib/content/catalog-context";
import { EXERCISES, KNIGHT_TOUR, LABYRINTHS } from "@/lib/game/exercises";
import { getLabyrinthBest } from "@/lib/game/labyrinth-progress";
import { GENERATED_EXERCISE_DESCRIPTIONS } from "@/lib/game/generated/puzzles.generated";
import {
  labyrinthBestStorageKey,
  milestoneStorageKey,
  pieceProgressStorageKey,
} from "@/lib/lite-progress-storage";
import { markMilestonesSeeded } from "@/lib/progression/seed-milestones";
import { renderWithAppProviders } from "@/test-utils/render-with-app-providers";

const entitlement = vi.hoisted(() => ({
  state: {
    active: false as boolean,
    source: null as "pro" | "season_pass" | null,
    loading: true,
  },
  refresh: vi.fn(),
}));

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

vi.mock("@/lib/season-pass/use-season-pass-status", () => ({
  useSeasonPassStatus: () => ({
    ...entitlement.state,
    seasonPassExpiresAt: null,
    proExpiresAt: null,
    seasonId: null,
    supporterStatus: null,
    shieldsCredited: 0,
    refresh: entitlement.refresh,
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

vi.mock("@/components/exercises/knight-tour-board", () => ({
  KnightTourBoard: ({
    level,
    onComplete,
  }: {
    level: { id: string; optimalMoves: number };
    onComplete?: (covered: number, ceiling: number) => void;
  }) => (
    <button
      type="button"
      data-testid={`mock-tour-${level.id}`}
      onClick={() => onComplete?.(18, level.optimalMoves + 1)}
    >
      Finish Tour
    </button>
  ),
}));

vi.mock("@/components/learn/learn-shop-sheet", () => ({
  LearnShopSheet: ({
    open,
    onSuccess,
  }: {
    open: boolean;
    onSuccess?: (result: never) => void;
  }) => open ? (
    <button
      type="button"
      data-testid="season-pass-sheet"
      onClick={() => onSuccess?.({} as never)}
    >
      Complete Pass Purchase
    </button>
  ) : null,
}));

class NoopIntersectionObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() { return []; }
  root = null;
  rootMargin = "";
  thresholds: number[] = [];
}
vi.stubGlobal("IntersectionObserver", NoopIntersectionObserver);

const { ExercisesScreen } = await import("../exercises-screen");

function screenTree(initialContentId?: string) {
  return (
    <ContentCatalogProvider
      value={{
        exercises: EXERCISES,
        labyrinths: LABYRINTHS,
        knightTour: KNIGHT_TOUR,
        descriptions: GENERATED_EXERCISE_DESCRIPTIONS,
      }}
    >
      <ExercisesScreen
        initialPiece="knight"
        initialContentId={initialContentId}
      />
    </ContentCatalogProvider>
  );
}

describe("ExercisesScreen Training Pass integration", () => {
  beforeEach(() => {
    localStorage.clear();
    entitlement.refresh.mockReset();
    Object.assign(entitlement.state, {
      active: false,
      source: null,
      loading: true,
    });
    const completed = EXERCISES.knight.slice(0, 3);
    localStorage.setItem(
      pieceProgressStorageKey("knight"),
      JSON.stringify({
        piece: "knight",
        currentId: completed[2].id,
        stars: Object.fromEntries(completed.map((exercise) => [exercise.id, 3])),
      }),
    );
    localStorage.setItem(
      labyrinthBestStorageKey("knight"),
      JSON.stringify({ "knight-tour-1": 12 }),
    );
    const now = new Date().toISOString();
    localStorage.setItem(
      milestoneStorageKey(),
      JSON.stringify({
        version: 1,
        events: {
          "first-reward": {
            id: "first-reward",
            earnedAt: now,
            celebratedAt: now,
          },
          "first-labyrinth:knight": {
            id: "first-labyrinth",
            piece: "knight",
            earnedAt: now,
            celebratedAt: now,
          },
        },
        dailyDate: now.slice(0, 10),
      }),
    );
    markMilestonesSeeded();
  });

  afterEach(() => cleanup());

  it("finishes a granted run after expiry, then blocks retry and reload restoration", async () => {
    const view = renderWithAppProviders(screenTree("knight-tour-2"));
    expect(screen.queryByTestId("mock-tour-knight-tour-2")).toBeNull();
    expect(screen.queryByTestId("season-pass-sheet")).toBeNull();

    Object.assign(entitlement.state, {
      active: true,
      source: "season_pass",
      loading: false,
    });
    view.rerender(screenTree("knight-tour-2"));
    const tour = await screen.findByTestId("mock-tour-knight-tour-2");

    Object.assign(entitlement.state, {
      active: false,
      source: null,
      loading: false,
    });
    view.rerender(screenTree("knight-tour-2"));
    expect(screen.getByTestId("mock-tour-knight-tour-2")).toBeInTheDocument();

    fireEvent.click(tour);
    await screen.findByRole("button", { name: "Try again" });
    expect(getLabyrinthBest("knight", "knight-tour-2")).toBe(18);
    expect(screen.queryByText("0/3")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    await screen.findByRole("button", {
      name: "Wider Ground. Challenge Pass / PRO. Unlock Challenges",
    });
    expect(screen.queryByTestId("mock-tour-knight-tour-2")).toBeNull();
    expect(screen.queryByTestId("season-pass-sheet")).toBeNull();

    view.unmount();
    renderWithAppProviders(screenTree());
    await screen.findByRole("button", {
      name: "Wider Ground. Challenge Pass / PRO. Unlock Challenges",
    });
    expect(screen.queryByTestId("mock-tour-knight-tour-2")).toBeNull();
    expect(screen.queryByTestId("season-pass-sheet")).toBeNull();
    expect(getLabyrinthBest("knight", "knight-tour-2")).toBe(18);

    fireEvent.click(screen.getByRole("button", {
      name: "Wider Ground. Challenge Pass / PRO. Unlock Challenges",
    }));
    fireEvent.click(await screen.findByTestId("season-pass-sheet"));
    expect(entitlement.refresh).toHaveBeenCalledTimes(1);
  });
});
