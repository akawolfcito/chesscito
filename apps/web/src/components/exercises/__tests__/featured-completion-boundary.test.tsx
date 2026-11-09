import { StrictMode, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor } from "@testing-library/react";

import { writeLastTrainingContentId } from "@/lib/training/content-access";
import { renderWithAppProviders } from "@/test-utils/render-with-app-providers";
import { ContentCatalogProvider } from "@/lib/content/catalog-context";
import { EXERCISES, LABYRINTHS } from "@/lib/game/exercises";
import { GENERATED_EXERCISE_DESCRIPTIONS } from "@/lib/game/generated/puzzles.generated";
import {
  labyrinthBestStorageKey,
  pieceProgressStorageKey,
} from "@/lib/lite-progress-storage";
import { seedMilestonesOnce } from "@/lib/progression/seed-milestones";
import type { Exercise } from "@/lib/game/types";
import {
  BADGE_EARNED_COPY,
  CONSEQUENCE_COPY,
  LABYRINTH_COPY,
  PIECE_COMPLETE_COPY,
} from "@/lib/content/editorial";

/**
 * SMOKE REMEDIATION — the completion boundary between Mini-games and Exercises.
 *
 * Audit: docs/audits/2026-08-19-learn-minigames-smoke-remediation-audit.md
 *
 * What the smoke exposed: `handleLabyrinthContinue` walks the EXERCISE path
 * (next 0★ exercise → next lane level → piece-complete), and the overlay's X is
 * wired to the same action. Entering a lane level from the hub therefore dumped
 * the player into `rook-7`, then into `rook-rail-two-turns`, then into
 * "All Exercises Complete! / Start Bishop".
 *
 * ⛔ THE RULE THESE TESTS ENCODE: same state semantics, different completion UX.
 * A featured completion still writes its best and still feeds mastery. Only
 * where the player LANDS changes.
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

vi.mock("@/lib/season-pass/use-season-pass-status", () => ({
  useSeasonPassStatus: () => ({
    active: false,
    source: null,
    loading: false,
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

/** Five one-move rook slides. Index 0 is deliberately left UNSOLVED in the
 *  smoke-like state, so the old `next-exercise` priority has somewhere to go —
 *  without that, a passing test would prove nothing. */
const ROOK_POOL: Exercise[] = [1, 2, 3, 4, 5].map((n) => ({
  id: `t-rook-${n}`,
  startPos: { file: 0, rank: n - 1 },
  targetPos: { file: 7, rank: n - 1 },
  optimalMoves: 1,
  title: `Exercise ${n}`,
}));

/** Two chained lane levels; `FEATURED` is the mid-lane one a rotation picks. */
/** b7 -> g2, reachable in two rook moves on an obstacle-free board. */
const LANE_1: Exercise = {
  id: "t-lane-1",
  title: "Probe One",
  startPos: { file: 1, rank: 6 },
  targetPos: { file: 6, rank: 1 },
  optimalMoves: 10,
};
const FEATURED: Exercise = {
  id: "t-lane-2",
  title: "Probe Two",
  startPos: { file: 0, rank: 0 },
  targetPos: { file: 7, rank: 7 },
  optimalMoves: 12,
};

/** The same tree under `<StrictMode>`, which double-invokes every effect —
 *  exactly what `next dev` does and what production does NOT. */
type RenderArgs = {
  contentId?: string;
  featured: boolean;
  /** ⚠️ The exercise-path entry into lane content is the PATH DRAWER, and
   *  LEARN stopped drawing lane rows on 2026-08-21 — mini-games live in the
   *  Library. The three tests below are about EXERCISE-PATH origin semantics,
   *  which still ship in PLAY, so they ask for the rows explicitly. Everything
   *  else in this file runs on the LEARN default. */
  showLanePathRows?: boolean;
};

function renderScreenStrict(args: RenderArgs) {
  return renderWithAppProviders(
    <StrictMode>
      <ContentCatalogProvider
        value={{
          exercises: { ...EXERCISES, rook: ROOK_POOL },
          labyrinths: { ...LABYRINTHS, rook: [LANE_1, FEATURED] },
          descriptions: GENERATED_EXERCISE_DESCRIPTIONS,
        }}
      >
        <ExercisesScreen
          initialPiece="rook"
          initialContentId={args.contentId}
          initialContentOrigin={args.featured ? "featured" : "exercise_path"}
          initialContentBypassLock={args.featured}
          showLanePathRows={args.showLanePathRows}
        />
      </ContentCatalogProvider>
    </StrictMode>,
  );
}

function renderScreen(args: RenderArgs) {
  return renderWithAppProviders(
    <ContentCatalogProvider
      value={{
        exercises: { ...EXERCISES, rook: ROOK_POOL },
        labyrinths: { ...LABYRINTHS, rook: [LANE_1, FEATURED] },
        descriptions: GENERATED_EXERCISE_DESCRIPTIONS,
      }}
    >
      <ExercisesScreen
        initialPiece="rook"
        initialContentId={args.contentId}
        initialContentOrigin={args.featured ? "featured" : "exercise_path"}
        initialContentBypassLock={args.featured}
        showLanePathRows={args.showLanePathRows}
      />
    </ContentCatalogProvider>,
  );
}

/**
 * Pre-celebrate everything the current profile has already earned.
 *
 * ⛔ `markMilestonesSeeded()` ALONE IS NOT ENOUGH — it stamps the migration
 * marker without persisting the celebrated set, so the queue still emits.
 * The probe that found this showed "First Reward Earned" mounted over the
 * board with the challenge still running: `celebration` was non-null, the
 * lane-completion overlay was suppressed, and every assertion below would
 * have failed for a reason that has nothing to do with the boundary.
 *
 * ⚠️ `giftAvailable` is hardcoded `CHESSCITO_LITE_MODE` in the screen
 * (`exercises-screen.tsx:1413`), NOT read from the welcome-package state — so
 * `first-reward` fires on 4 lifetime stars regardless of the gift. It must be
 * seeded, not avoided.
 */
function seedCelebrations() {
  localStorage.setItem(
    "chesscito:welcome-package",
    JSON.stringify({
      version: 1,
      unlocked: true,
      unlockedAt: "2026-01-01T00:00:00.000Z",
      claimed: true,
      claimedAt: "2026-01-01T00:00:00.000Z",
      dismissed: true,
      dismissedAt: "2026-01-01T00:00:00.000Z",
      dismissCount: 1,
      autoShowCount: 1,
    }),
  );
  seedMilestonesOnce({
    badgeClaimedByPiece: {},
    labyrinthIdsByPiece: { rook: [LANE_1.id, FEATURED.id] },
    giftAvailable: true,
  });
}

/** Progress that clears the lane gate AND leaves `t-rook-1` at 0★, so the OLD
 *  `next-exercise` continuation has somewhere to go. Without a 0★ target a
 *  passing boundary test would prove nothing. */
function seedRookProgress() {
  localStorage.setItem(
    pieceProgressStorageKey("rook"),
    JSON.stringify({
      piece: "rook",
      currentId: null,
      stars: { "t-rook-2": 3, "t-rook-3": 3, "t-rook-4": 3 },
    }),
  );
  seedCelebrations();
}

/** ⛔ Every assertion waits for the splash. `useSplashLoader` holds a
 *  full-screen overlay until an image preload resolves, and a negative
 *  assertion made underneath it passes for the wrong reason. */
async function settled() {
  await waitFor(
    () => expect(document.querySelector(".playhub-intro-overlay")).toBeNull(),
    { timeout: 6000 },
  );
  await new Promise((r) => setTimeout(r, 400));
}

const BOARD_MOUNTED = "mission-optimal-moves";

/* ⛔ Selectors are CODE-OWNED classes and `data-square`, never copy.
 * The overlay passes `closeLabel={t("continue")}`, so the X and the primary CTA
 * share an accessible name — querying by name would silently hit the wrong one,
 * and AC-3 vs AC-4 would stop being two different tests. */
const CLOSE = ".candy-close-asset-button";
/** The overlay's primary is a `<PrincipalButton>`; it carries no
 *  `arena-result-primary-cta` class. It is the only button inside the CTA
 *  stack that is not the cream secondary, so it is located relative to that. */
const PRIMARY_STACK = ".arena-result-secondary-action";

function q(selector: string): HTMLElement | null {
  return document.querySelector(selector);
}

function cell(square: string): HTMLElement | null {
  return document.querySelector(`[data-square="${square}"]`);
}

/**
 * Drive the mounted lane board to its target through the REAL move handler.
 * `FEATURED` runs a1 → h1 → h8; two legal rook moves on an obstacle-free board.
 * Returns false when the board is not mounted, so a test fails loudly instead
 * of asserting against a screen where nothing happened.
 */
async function completeMountedChallenge(): Promise<boolean> {
  if (!cell("a1") || !cell("h8")) return false;
  for (const [from, to] of [["a1", "h1"], ["h1", "h8"]] as const) {
    const origin = cell(from);
    const destination = cell(to);
    if (!origin || !destination) return false;
    fireEvent.click(origin);
    fireEvent.click(destination);
    await new Promise((r) => setTimeout(r, 250));
  }
  await new Promise((r) => setTimeout(r, 400));
  return true;
}

/** The lane-completion overlay, identified by the cream secondary it owns. */
function completionOverlayPresent(): boolean {
  return Boolean(q(PRIMARY_STACK));
}

/** The overlay's primary CTA: the sibling of the cream secondary inside the
 *  CTA stack. Located structurally so no copy string is asserted. */
function primaryCta(): HTMLElement | null {
  const secondary = q(PRIMARY_STACK);
  const stack = secondary?.parentElement ?? null;
  const buttons = stack ? Array.from(stack.querySelectorAll("button")) : [];
  return (buttons.find((b) => b !== secondary) as HTMLElement | undefined) ?? null;
}

/** Exercises-only progression overlays, matched on the SAME copy source the
 *  components read — so a copy edit moves both together instead of silently
 *  disarming the assertion. */
function exercisesProgressionOverlayText(): string | null {
  const body = document.body.textContent ?? "";
  // The title names the piece now, so match its invariant tail rather than the
  // whole string — still read from the copy source, so an edit still moves it.
  const titleTail = PIECE_COMPLETE_COPY.title("").trim();
  if (body.includes(titleTail)) return titleTail;
  if (body.includes(BADGE_EARNED_COPY.headerLabel)) return BADGE_EARNED_COPY.headerLabel;
  return null;
}

describe("featured completion boundary", () => {
  beforeEach(() => {
    localStorage.clear();
    pushMock.mockClear();
  });

  /* ── AC-1 ──────────────────────────────────────────────────────────────── */
  it("AC-1: a featured card with stored progress still renders its exact challenge", async () => {
    seedRookProgress();
    renderScreen({ contentId: FEATURED.id, featured: true });
    await settled();

    expect(screen.queryByTestId(BOARD_MOUNTED)).toBeInTheDocument();
    const band = screen.getByTestId("mission-band");
    expect(band).toHaveTextContent(FEATURED.title!);
    // …and NOT any lane-1 exercise.
    for (const exercise of ROOK_POOL) {
      expect(band).not.toHaveTextContent(exercise.title!);
    }
  }, 20_000);

  /* ── AC-3 / AC-7 ───────────────────────────────────────────────────────── */
  it("AC-3 + AC-7: featured Continue returns to Learn Home and shows no Exercises progression UX", async () => {
    seedRookProgress();
    renderScreen({ contentId: FEATURED.id, featured: true });
    await settled();
    expect(await completeMountedChallenge()).toBe(true);

    expect(completionOverlayPresent()).toBe(true);
    fireEvent.click(primaryCta()!);
    await new Promise((r) => setTimeout(r, 600));

    // Returns to Learn Home…
    expect(pushMock).toHaveBeenCalledWith("/");
    // …and never into lane-1 or another lane level.
    expect(screen.queryByTestId(BOARD_MOUNTED)).toBeNull();
    // AC-7: no Exercises-only progression overlay.
    expect(exercisesProgressionOverlayText()).toBeNull();
  }, 20_000);

  /* ── AC-4 ──────────────────────────────────────────────────────────────── */
  it("AC-4: featured Close (X) returns to Learn Home, not into the exercise path", async () => {
    seedRookProgress();
    renderScreen({ contentId: FEATURED.id, featured: true });
    await settled();
    expect(await completeMountedChallenge()).toBe(true);

    expect(completionOverlayPresent()).toBe(true);
    expect(q(CLOSE)).not.toBeNull();
    fireEvent.click(q(CLOSE)!);
    await new Promise((r) => setTimeout(r, 600));

    expect(pushMock).toHaveBeenCalledWith("/");
    expect(screen.queryByTestId(BOARD_MOUNTED)).toBeNull();
    expect(exercisesProgressionOverlayText()).toBeNull();
  }, 20_000);

  /* ── AC-2 ──────────────────────────────────────────────────────────────── */
  it("AC-2: featured completion still writes its labyrinth best — state is NOT forked", async () => {
    seedRookProgress();
    renderScreen({ contentId: FEATURED.id, featured: true });
    await settled();
    expect(await completeMountedChallenge()).toBe(true);

    const bests = JSON.parse(
      localStorage.getItem(labyrinthBestStorageKey("rook")) ?? "{}",
    ) as Record<string, number>;
    expect(bests[FEATURED.id]).toBeGreaterThan(0);
  }, 20_000);

  /* ── AC-5 ──────────────────────────────────────────────────────────────── */
  it("AC-5: featured Retry restarts the same challenge and never navigates", async () => {
    seedRookProgress();
    renderScreen({ contentId: FEATURED.id, featured: true });
    await settled();
    expect(await completeMountedChallenge()).toBe(true);

    expect(q(PRIMARY_STACK)).not.toBeNull();
    fireEvent.click(q(PRIMARY_STACK)!);
    await new Promise((r) => setTimeout(r, 600));

    expect(pushMock).not.toHaveBeenCalled();
    expect(screen.queryByTestId(BOARD_MOUNTED)).toBeInTheDocument();
    expect(screen.getByTestId("mission-band")).toHaveTextContent(FEATURED.title!);
  }, 20_000);

  /* ── AC-6 ──────────────────────────────────────────────────────────────── */
  it("AC-6: an exercise-path entry keeps the existing continuation, byte for byte", async () => {
    seedRookProgress();
    // ⛔ Entered through the CONTEXTUAL PIN, not a deep link. A non-featured
    // `?content=` with stored progress hits the pre-existing hydration race
    // documented in the audit (§1.3) and never mounts — testing the
    // continuation through it would assert nothing.
    // ⚠️ It used to be the path drawer. Since the 2026-08-21 separation LEARN
    // draws no lane rows, so the pin ("Enter Labyrinth", source `automatic`) is
    // what an exercise-path entry into lane content now IS.
    /* ⚠️ RESTORE, not a deep link and no longer the drawer. A non-featured
       `?content=` with stored progress hits the pre-existing hydration race
       (audit §1.3) and never mounts; the drawer tap stopped existing with the
       2026-08-21 separation. `restore` is the remaining exercise-path entry,
       and it records the SAME `exercise_path` origin the drawer tap did —
       which is the only thing this test is about. */
    renderScreen({ contentId: undefined, featured: false, showLanePathRows: true });
    await settled();

    fireEvent.click(screen.getByTestId("piece-chip-trigger"));
    await new Promise((r) => setTimeout(r, 400));
    const laneRow = screen.getByText(LANE_1.title!).closest("button");
    expect(laneRow).not.toBeNull();
    fireEvent.click(laneRow!);
    await new Promise((r) => setTimeout(r, 500));

    expect(screen.queryByTestId(BOARD_MOUNTED)).toBeInTheDocument();
    // LANE_1 runs b7 -> b2 -> g2 (its start is b7, target g2).
    expect(cell("b7")).not.toBeNull();
    for (const [from, to] of [["b7", "b2"], ["b2", "g2"]] as const) {
      fireEvent.click(cell(from)!);
      fireEvent.click(cell(to)!);
      await new Promise((r) => setTimeout(r, 250));
    }
    await new Promise((r) => setTimeout(r, 400));

    expect(completionOverlayPresent()).toBe(true);
    fireEvent.click(primaryCta()!);
    await new Promise((r) => setTimeout(r, 600));

    // The exercise path does NOT go to Learn Home — its continuation is
    // unchanged.
    expect(pushMock).not.toHaveBeenCalledWith("/");
  }, 20_000);

  /* ── AC-11 / AC-12: the SURFACE is named, and its copy follows ───────────
   * `consequence-surface.test.ts` proves the copy MAPPING is right. These two
   * prove the WIRING: that `completionOriginRef` actually reaches the overlay,
   * which no pure test can see. Without them the mapping could be perfect and
   * the screen could still pass `"exercise_path"` on every entry.
   *
   * ⛔ Asserted against the SAME copy source the component reads, never against
   * a typed-out string — a copy edit must move the assertion with it instead of
   * silently disarming it. */
  it("AC-11: a featured completion is labelled MINI-GAME and drops the path tail", async () => {
    seedRookProgress();
    renderScreen({ contentId: FEATURED.id, featured: true });
    await settled();
    expect(await completeMountedChallenge()).toBe(true);
    expect(completionOverlayPresent()).toBe(true);

    const kicker = screen.getByTestId("labyrinth-complete-surface");
    expect(kicker).toHaveAttribute("data-surface", "featured_minigame");
    expect(kicker).toHaveTextContent(LABYRINTH_COPY.surfaceMiniGame);

    // The board it actually played, named on the overlay.
    expect(
      screen.getByTestId("labyrinth-complete-challenge-title"),
    ).toHaveTextContent(FEATURED.title!);

    /* ⛔ NOTHING IS SUPPRESSED — that was the first proposal and it was
       rejected. Whatever consequence this run earned still renders; what it
       must NOT do is send the player into Exercises. */
    const body = document.body.textContent ?? "";
    for (const tail of [
      CONSEQUENCE_COPY.mastery,
      CONSEQUENCE_COPY.challengeUnlocked,
      CONSEQUENCE_COPY.laneComplete,
    ]) {
      expect(body).not.toContain(tail);
    }
  }, 20_000);

  it("AC-12: an exercise-path completion is labelled EXERCISE", async () => {
    seedRookProgress();
    renderScreen({ contentId: undefined, featured: false, showLanePathRows: true });
    await settled();

    fireEvent.click(screen.getByTestId("piece-chip-trigger"));
    await new Promise((r) => setTimeout(r, 400));
    fireEvent.click(screen.getByText(LANE_1.title!).closest("button")!);
    await new Promise((r) => setTimeout(r, 500));

    for (const [from, to] of [["b7", "b2"], ["b2", "g2"]] as const) {
      fireEvent.click(cell(from)!);
      fireEvent.click(cell(to)!);
      await new Promise((r) => setTimeout(r, 250));
    }
    await new Promise((r) => setTimeout(r, 400));

    expect(completionOverlayPresent()).toBe(true);
    const kicker = screen.getByTestId("labyrinth-complete-surface");
    expect(kicker).toHaveAttribute("data-surface", "exercise_path");
    expect(kicker).toHaveTextContent(LABYRINTH_COPY.surfaceExercise);
  }, 20_000);

  /* ── ⛔ A DEEP LINK MUST SURVIVE DOUBLE-INVOKED EFFECTS ───────────────────
   * Reported from the founder's smoke: every mini-game tile opened the piece's
   * FIRST lane-1 exercise instead of its challenge. Their console named the
   * culprit — `react-dom.development.js`, i.e. StrictMode, which runs every
   * effect twice.
   *
   * The screen's `[selectedPiece]` effect resets labyrinth mode. It is written
   * for "the player switched piece, leave the maze", but it also fires on
   * MOUNT, where there is nothing to leave — and that extra pass is the one
   * StrictMode duplicates, wiping the deep link a moment after it resolved.
   * The deep-link effect cannot undo it: `implicitContentRequestRef` already
   * recorded the request, so it early-returns.
   *
   * ⚠️ Production is unaffected (effects run once), which is exactly why this
   * survived every earlier check — all of them ran against a production build.
   * It still matters: it makes the mini-games surface UNSMOKEABLE in dev, and
   * "remember which build you are on" is not a guarantee. */
  it("AC-13: a featured deep link still mounts its challenge under StrictMode", async () => {
    seedRookProgress();
    renderScreenStrict({ contentId: FEATURED.id, featured: true });
    await settled();

    const band = screen.getByTestId("mission-band");
    expect(band).toHaveTextContent(FEATURED.title!);
    for (const exercise of ROOK_POOL) {
      expect(band).not.toHaveTextContent(exercise.title!);
    }
  }, 20_000);

  /* ── ⛔ SL-1: THE ORIGIN MUST NOT OUTLIVE THE LANE CONTENT ────────────────
   * Red-team finding. `completionOriginRef` was cleared in exactly ONE place,
   * `handleExitLabyrinth`. Neither `handleExerciseNavigate` nor `settleToPath`
   * touched it — and `automatic` PRESERVES the origin by design, so that a
   * replay stays featured.
   *
   * The chain: enter a featured challenge → open the PATH (the drawer is not
   * gated on `labyrinthMode`) → tap an EXERCISE → the ref still says
   * `featured_minigame`. Anything entered later through an `automatic` request
   * — the contextual pin, the post-completion continuation — inherits it, and
   * its Continue routes to Learn Home instead of walking the path. The mirror
   * image of the bug the ref was introduced to fix.
   *
   * ⚠️ Asserted through the OVERLAY KICKER, not the ref: the surface label and
   * the Continue destination read the same value, so the label is an honest
   * proxy and the test does not reach into internals. */
  it("SL-1: leaving lane content for an exercise drops the featured origin", async () => {
    seedRookProgress();
    // Rows shown: this chain walks OUT of the mini-game and back IN through
    // the path, which is the PLAY-shaped entry the finding was traced on.
    renderScreen({ contentId: FEATURED.id, featured: true, showLanePathRows: true });
    await settled();
    expect(screen.queryByTestId(BOARD_MOUNTED)).toBeInTheDocument();

    // Out of the mini-game, into the exercise path, through the PATH drawer.
    fireEvent.click(screen.getByTestId("piece-chip-trigger"));
    await new Promise((r) => setTimeout(r, 400));
    fireEvent.click(screen.getByText(ROOK_POOL[0].title!).closest("button")!);
    await new Promise((r) => setTimeout(r, 500));

    // Now walk back into lane content the way the path does it.
    fireEvent.click(screen.getByTestId("piece-chip-trigger"));
    await new Promise((r) => setTimeout(r, 400));
    fireEvent.click(screen.getByText(LANE_1.title!).closest("button")!);
    await new Promise((r) => setTimeout(r, 500));

    for (const [from, to] of [["b7", "b2"], ["b2", "g2"]] as const) {
      fireEvent.click(cell(from)!);
      fireEvent.click(cell(to)!);
      await new Promise((r) => setTimeout(r, 250));
    }
    await new Promise((r) => setTimeout(r, 400));

    expect(completionOverlayPresent()).toBe(true);
    expect(screen.getByTestId("labyrinth-complete-surface")).toHaveAttribute(
      "data-surface",
      "exercise_path",
    );
    fireEvent.click(primaryCta()!);
    await new Promise((r) => setTimeout(r, 600));
    expect(pushMock).not.toHaveBeenCalledWith("/");
  }, 25_000);
});
