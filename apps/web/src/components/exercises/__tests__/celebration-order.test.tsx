import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";

import { renderWithAppProviders } from "@/test-utils/render-with-app-providers";
import { ContentCatalogProvider } from "@/lib/content/catalog-context";
import { EXERCISES, LABYRINTHS } from "@/lib/game/exercises";
import { GENERATED_EXERCISE_DESCRIPTIONS } from "@/lib/game/generated/puzzles.generated";
import {
  dailySessionStorageKey,
  dailyStarsStorageKey,
  milestoneStorageKey,
  pieceProgressStorageKey,
} from "@/lib/lite-progress-storage";
import { getDailyStars } from "@/lib/progression/stars";
import { markMilestonesSeeded } from "@/lib/progression/seed-milestones";
import { getWelcomePackageState } from "@/lib/welcome-package/storage";
import type { Exercise } from "@/lib/game/types";

/**
 * Task 13 — THE inversion this cluster exists to fix, plus the composition
 * hazards its review found.
 *
 * The evaluation order is the contract:
 *   1. record the activity → 2. evaluate milestones → 3. persist →
 *   4. build + drain the queue → 5. render → 6. return to the experience →
 *   7. ONLY THEN, on the next start, evaluate the session limit.
 *
 * And the governing rule of the whole cluster: EXACTLY ONE DIALOG PER DRAIN.
 * An absorbed recognition is a LINE inside the closer, never a second modal.
 * The hook's unit tests prove the queue in isolation; only a screen-level test
 * proves the queue COMPOSED with the legacy popups that share the same
 * `VictoryPopupShell` z-layer — and that gap is exactly what let the stacked
 * badge dialogs through the first time.
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

/** jsdom has no IntersectionObserver; the WELL DONE Lottie observes its canvas
 *  on mount and would otherwise throw into whichever async test is running. */
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

/** Five trivial one-move rook slides. `optimalMoves: 1` → every solve is a
 *  clean 3★, so the star arithmetic in the assertions is exact. */
const ROOK_POOL: Exercise[] = [1, 2, 3, 4, 5].map((n) => ({
  id: `t-rook-${n}`,
  startPos: { file: 0, rank: n - 1 },
  targetPos: { file: 7, rank: n - 1 },
  optimalMoves: 1,
}));

/** One trivial maze: a clean vertical slide, no obstacles in the way. */
const ROOK_LAB: Exercise = {
  id: "t-lab-1",
  startPos: { file: 3, rank: 0 },
  targetPos: { file: 3, rank: 7 },
  optimalMoves: 1,
  obstacles: [],
};

function renderScreen(labyrinths: Exercise[] = []) {
  return renderWithAppProviders(
    <ContentCatalogProvider
      value={{
        exercises: { ...EXERCISES, rook: ROOK_POOL },
        labyrinths: { ...LABYRINTHS, rook: labyrinths },
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

/** Enters the maze the way a player does: open the path drawer, tap the node.
 *  (The contextual "Enter Labyrinth" pin is not reachable here — the Welcome
 *  Pack CTA legitimately owns the idle action slot until it is claimed.) */
async function enterLabyrinth() {
  fireEvent.click(screen.getByRole("button", { name: "Exercises" }));
  const node = await screen.findByRole("button", { name: "Special Training 1" });
  fireEvent.click(node);
  // The exit pin only exists inside the labyrinth layer — proof we are in.
  await screen.findByRole("button", { name: "Exit Training" });
}

/** Modals on screen, counted the way the player experiences them: every one of
 *  these is a `VictoryPopupShell` at `z-[70]` with `aria-modal="true"`. Some
 *  pass `role="alert"` (the labyrinth score card) instead of `role="dialog"`,
 *  so counting by role alone would miss a stacked popup. */
function modalCount(): number {
  return document.querySelectorAll('[aria-modal="true"]').length;
}

/** The WELL DONE flash now holds for the player's tap, and its reward/milestone
 *  modal stays back until then (they no longer stack — founder 2026-07-17).
 *  Drive that tap the way a player does: wait for the prompt to arm, tap it, and
 *  let the flash fade out so the queued recognition can take the stage. */
async function tapPastWellDone() {
  await screen.findByText("Tap to Continue", undefined, { timeout: 2500 });
  fireEvent.click(screen.getByRole("button", { name: "Tap to Continue" }));
  await waitFor(() => {
    expect(screen.queryByText("Tap to Continue")).not.toBeInTheDocument();
  });
}

function seedRookProgress(currentId: string, stars: Record<string, number>) {
  localStorage.setItem(
    pieceProgressStorageKey("rook"),
    JSON.stringify({ piece: "rook", currentId, stars }),
  );
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Pre-credits the daily star ledger, so a single 3★ solve can be pushed over
 *  GREAT_SESSION_STARS (8) without burning the session quota. */
function seedDailyStars(stars: number) {
  localStorage.setItem(
    dailyStarsStorageKey(),
    JSON.stringify({ date: today(), stars }),
  );
}

/**
 * Marks milestones as already earned AND already celebrated, so they neither
 * re-fire nor crowd the queue. Lets a test isolate the ONE recognition it is
 * about. Keys are `id` or `id:piece` — the same `milestoneKey` shape the store
 * writes.
 */
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

/** Burns the free daily quota (10 slots) on unrelated content. */
function exhaustSessionQuota() {
  localStorage.setItem(
    dailySessionStorageKey(),
    JSON.stringify({
      date: today(),
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
  // Every player here is ALREADY on the milestone machine: the one-time
  // migration (Task 15) has run for their profile. Without this marker the
  // screen would seed them as veterans on mount — correct for a returning
  // player, but it would stamp the very gates these tests exist to watch
  // cross, and every celebration below would be (correctly) suppressed.
  markMilestonesSeeded();
  pushMock.mockClear();
});

afterEach(() => {
  cleanup();
});

describe("celebration order on the exercises screen", () => {
  it("never shows the session limit while a recognition is pending", async () => {
    exhaustSessionQuota();
    renderScreen();

    // Pre-state: the quota is spent, so the limit card owns the screen.
    expect(screen.getByText("Great focus today!")).toBeInTheDocument();

    // A fresh solve with the quota already burned: the session ended, so the
    // Great Focus Session fires — after the WELL DONE flash is tapped past.
    solve(ROOK_POOL[0]);
    await tapPastWellDone();

    expect(await screen.findByText("Great Focus Session")).toBeInTheDocument();
    expect(screen.queryByText("Great focus today!")).not.toBeInTheDocument();
  });

  it("shows the gift overlay before the maze overlay, never stacked", async () => {
    // 6★ across 2 exercises already; the third solve crosses BOTH the gift
    // gate (4★ / 2 exercises) and the maze gate (6★ / 3 exercises) at once.
    seedRookProgress("t-rook-3", { "t-rook-1": 3, "t-rook-2": 3 });
    renderScreen();

    solve(ROOK_POOL[2]);
    await tapPastWellDone();

    expect(await screen.findByText("First Reward Earned")).toBeInTheDocument();
    expect(screen.getAllByRole("dialog")).toHaveLength(1);
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

describe("one dialog per drain (composition)", () => {
  /** CRITICAL 1 — every player hits this. The solve that crosses 10★ used to
   *  mount `<UnlockOverlay>` AND the legacy `<BadgeEarnedPrompt>`: two
   *  `VictoryPopupShell`s, both `role="dialog"`, both `z-[70]`, the later one
   *  in JSX painting over the other. */
  it("renders exactly ONE dialog on the solve that crosses the badge threshold", () => {
    seedCelebrated("first-reward", "first-labyrinth:rook", "special-training");
    // 12★ over four exercises; the fifth (last) solve makes it 15★ — the badge
    // prompt's own `newTotal >= BADGE_THRESHOLD && isLastExercise` trigger AND
    // the machine's `pieceStars >= BADGE_THRESHOLD`, on the same tap.
    seedRookProgress("t-rook-5", {
      "t-rook-1": 3,
      "t-rook-2": 3,
      "t-rook-3": 3,
      "t-rook-4": 3,
    });
    renderScreen();

    solve(ROOK_POOL[4]);

    expect(screen.getAllByRole("dialog")).toHaveLength(1);
    expect(modalCount()).toBe(1);
    // The milestone machine owns the badge moment: its overlay is the one that
    // can actually CLAIM. The legacy prompt only said "Continue".
    expect(screen.getByText("Badge Ready to Claim")).toBeInTheDocument();
    expect(document.querySelector("#badge-earned-title")).toBeNull();
  });

  /** CRITICAL 1, labyrinth path — `labyrinthCompleted` + the overlay from
   *  `resolveMilestonesRef.current()` fire in the same tick. */
  it("renders exactly ONE dialog when a labyrinth completion fires a recognition", async () => {
    seedCelebrated("first-reward", "first-labyrinth:rook");
    seedRookProgress("t-rook-4", {
      "t-rook-1": 3,
      "t-rook-2": 3,
      "t-rook-3": 3,
    });
    seedDailyStars(6); // +3 from the maze → 9 ≥ GREAT_SESSION_STARS (8)
    renderScreen([ROOK_LAB]);

    // 9★ over 3 exercises unlocks the maze, so the idle action slot offers it.
    await enterLabyrinth();
    solve(ROOK_LAB);

    await waitFor(() => {
      expect(screen.getByText("Great Focus Session")).toBeInTheDocument();
    });
    expect(modalCount()).toBe(1);
    expect(screen.queryByText("Training Complete!")).not.toBeInTheDocument();

    // The maze score card is a CONTINUATION, not a celebration — suppressed,
    // never lost. It comes back the moment the queue drains.
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    await waitFor(() => {
      expect(screen.getByText("Training Complete!")).toBeInTheDocument();
    });
    expect(modalCount()).toBe(1);
  });

  /** IMPORTANT 5(a) — the claim-cancel ordering, at the composition level.
   *  A badge claim that never completes must NOT consume the Great Focus
   *  Session it absorbed. `releaseAbsorbed` runs, `dismissCurrent` does not. */
  it("still recognizes an absorbed Great Focus Session when the badge claim does not complete", async () => {
    seedCelebrated("first-reward", "first-labyrinth:rook", "special-training");
    seedRookProgress("t-rook-5", {
      "t-rook-1": 3,
      "t-rook-2": 3,
      "t-rook-3": 3,
      "t-rook-4": 3,
    });
    seedDailyStars(6); // +3 from the solve → 9 ≥ 8
    renderScreen();

    solve(ROOK_POOL[4]);

    // The badge is the closer; the Great Focus Session is absorbed INTO it.
    expect(screen.getByText("Badge Ready to Claim")).toBeInTheDocument();
    expect(screen.getByText("Great Focus Session recognized.")).toBeInTheDocument();
    expect(screen.getAllByRole("dialog")).toHaveLength(1);

    // No wallet → the claim resolves `false` (the cancellation shape).
    fireEvent.click(screen.getByRole("button", { name: "Claim Badge" }));

    await waitFor(() => {
      expect(screen.getByText("Great Focus Session")).toBeInTheDocument();
    });
    expect(modalCount()).toBe(1);
  });
});

describe("the daily star ledger takes only NET improvement", () => {
  /** IMPORTANT 5(c) — if a replay ever credited its full star count, a player
   *  could grind one solved exercise into a Great Focus Session. */
  it("adds ZERO to dailyStars when a solved exercise is replayed", () => {
    seedRookProgress("t-rook-1", { "t-rook-1": 3 });
    renderScreen();

    expect(getDailyStars()).toBe(0);
    solve(ROOK_POOL[0]); // same 3★, no improvement
    expect(getDailyStars()).toBe(0);
  });

  /** IMPORTANT 5(b) — a session spent in the mazes must still be able to reach
   *  a Great Focus Session. `addNetStars` is fed the PRE-solve best: if it ever
   *  read the post-solve best the net gain would always be 0, `dailyStars`
   *  would never grow, and the whole suite would still be green. */
  it("credits a first labyrinth completion to dailyStars", async () => {
    seedCelebrated("first-reward", "first-labyrinth:rook");
    seedRookProgress("t-rook-4", {
      "t-rook-1": 3,
      "t-rook-2": 3,
      "t-rook-3": 3,
    });
    renderScreen([ROOK_LAB]);

    expect(getDailyStars()).toBe(0);
    await enterLabyrinth();
    solve(ROOK_LAB);

    await waitFor(() => {
      expect(screen.getByText("Training Complete!")).toBeInTheDocument();
    });
    expect(getDailyStars()).toBe(3);
  });
});

describe("first-reward routes to the gift, not the shield Welcome Pack", () => {
  /** CRITICAL 2 — the overlay promised the Welcome Package GIFT
   *  (`lib/welcome-package/storage.ts`, `unlocked`/`claimed`). Its primary used
   *  to call `useWelcomePackClaim().onClaim()` — the SERVER SHIELD Welcome Pack:
   *  a different product, a `personal_sign` → `/api/welcome-pack/claim`
   *  round-trip, never gated on this unlock. */
  it("opens the Welcome Package gift modal from the primary CTA", async () => {
    // 3★ on one exercise; the second solve reaches 6★ / 2 exercises → the gift
    // gate (4★ / 2). Still only 2 exercises, so the maze gate (3) stays shut
    // and `first-reward` is the ONLY step in the queue.
    seedRookProgress("t-rook-2", { "t-rook-1": 3 });
    renderScreen();

    solve(ROOK_POOL[1]);
    await tapPastWellDone();
    expect(await screen.findByText("First Reward Earned")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Open Gift" }));

    await waitFor(() => {
      expect(screen.getByTestId("welcome-package-modal")).toBeInTheDocument();
    });
    // Still exactly one modal — the overlay handed the moment over, it did
    // not stack on top of it.
    expect(modalCount()).toBe(1);
    expect(screen.queryByText("First Reward Earned")).not.toBeInTheDocument();
  });

  it("claims the gift through the modal, flipping the real `claimed` flag", async () => {
    seedRookProgress("t-rook-2", { "t-rook-1": 3 });
    renderScreen();

    solve(ROOK_POOL[1]);
    await tapPastWellDone();
    await screen.findByText("First Reward Earned");
    fireEvent.click(screen.getByRole("button", { name: "Open Gift" }));
    await screen.findByTestId("welcome-package-modal");

    expect(getWelcomePackageState().claimed).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "Claim" }));

    await waitFor(() => {
      expect(getWelcomePackageState().claimed).toBe(true);
    });
  });
});
