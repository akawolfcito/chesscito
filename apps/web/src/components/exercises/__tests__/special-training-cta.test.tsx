import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";

import { renderWithAppProviders } from "@/test-utils/render-with-app-providers";
import { ContentCatalogProvider } from "@/lib/content/catalog-context";
import { EXERCISES, LABYRINTHS } from "@/lib/game/exercises";
import { GENERATED_EXERCISE_DESCRIPTIONS } from "@/lib/game/generated/puzzles.generated";
import {
  milestoneStorageKey,
  pieceProgressStorageKey,
} from "@/lib/lite-progress-storage";
import { markMilestonesSeeded } from "@/lib/progression/seed-milestones";
import type { Exercise } from "@/lib/game/types";

/**
 * The Special Training celebration must open the door it just promised.
 *
 * It used to `router.push("/hub")`, aiming at `HubArenaTile` — a tile that only
 * mounts inside the FULL `HubScaffold`. FULL is internal-only: the builds that
 * ship are LEARN (lite) and PLAY, and LEARN's hub renders `HubLiteScaffold`,
 * which has no such tile. So the overlay handed the player a CTA and dropped
 * them on a hub with no door. Found on device (2026-07-12), with the suite green
 * — the hub tile and the overlay were each correct alone.
 *
 * The door that actually ships is `MiniArenaBridgeSlot`, in the exercises
 * action row. This pins the CTA to it.
 *
 * Harness mirrors `celebration-order.test.tsx`.
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

/** Five trivial one-move rook slides — every solve is a clean 3★. */
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

/**
 * The panel arms its tap prompt on a real `setTimeout`, not on a render:
 * `mission-panel-candy.tsx` waits `entryBeat + 550`, and `entryBeat` is 600 on
 * success — 1150 ms of wall clock before "Tap to Continue" can appear.
 *
 * This used to wait with `{ timeout: 2500 }`, i.e. 1.17x the nominal delay.
 * That is enough on an idle machine and not enough inside a loaded suite, where
 * jsdom timers drift: the test passed alone and failed roughly two runs in
 * three under the full suite (2026-08-04). Raising the number would only move
 * the threshold, so the wait is derived from the component's own timing and
 * given a margin sized for a loaded worker rather than a lucky one.
 */
const TAP_ARM_DELAY_MS = 600 + 550;
const TAP_ARM_TIMEOUT_MS = TAP_ARM_DELAY_MS * 4;

/** The WELL DONE flash now holds for the player's tap before the queued
 *  recognition takes the stage (founder 2026-07-17). Wait for the prompt to
 *  arm, then tap past it. */
async function tapPastWellDone() {
  await screen.findByText("Tap to Continue", undefined, {
    timeout: TAP_ARM_TIMEOUT_MS,
  });
  fireEvent.click(screen.getByRole("button", { name: "Tap to Continue" }));
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Already earned AND already celebrated, so they neither re-fire nor crowd the
 *  queue — leaving Special Training as the only recognition under test. */
function seedCelebrated(...keys: string[]) {
  const now = new Date().toISOString();
  const events: Record<string, unknown> = {};
  for (const key of keys) {
    const [id, piece] = key.split(":");
    events[key] = piece
      ? { id, piece, earnedAt: now, celebratedAt: now }
      : { id, earnedAt: now, celebratedAt: now };
  }
  localStorage.setItem(
    milestoneStorageKey(),
    JSON.stringify({ version: 1, events, dailyDate: today() }),
  );
}

describe("Special Training celebration — the CTA opens the door it promised", () => {
  beforeEach(() => {
    localStorage.clear();
    pushMock.mockClear();
    // Nine rook stars banked across three solves; the fourth lands on 12 —
    // SPECIAL_TRAINING_ROOK_STARS — and fires the milestone.
    localStorage.setItem(
      pieceProgressStorageKey("rook"),
      JSON.stringify({
        piece: "rook",
        currentId: "t-rook-4",
        stars: { "t-rook-1": 3, "t-rook-2": 3, "t-rook-3": 3 },
      }),
    );
    // Everything the player already passed on the way to 12★, so the queue
    // holds exactly one step.
    seedCelebrated(
      "first-reward",
      "first-labyrinth:rook",
      "piece-badge-eligible:rook",
    );
    markMilestonesSeeded();
  });

  afterEach(() => {
    cleanup();
  });

  it("opens the mini-arena sheet in place instead of navigating to a hub with no tile", async () => {
    renderScreen();

    solve(ROOK_POOL[3]);
    await tapPastWellDone();

    const cta = await screen.findByRole("button", { name: "Start Training" });
    fireEvent.click(cta);

    // The promised content, right here.
    await waitFor(() => {
      expect(screen.getByTestId("mini-arena-sheet")).toBeInTheDocument();
    });

    // And NOT a trip to the hub. `/hub` redirects to `/`, where the LEARN hub
    // renders no Special Training tile at all — the dead end this test pins.
    expect(pushMock).not.toHaveBeenCalledWith("/hub");
  });
});
