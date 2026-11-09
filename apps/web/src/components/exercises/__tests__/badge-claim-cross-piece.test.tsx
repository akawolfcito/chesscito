import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, screen } from "@testing-library/react";

import { renderWithAppProviders } from "@/test-utils/render-with-app-providers";
import { ContentCatalogProvider } from "@/lib/content/catalog-context";
import { EXERCISES, LABYRINTHS } from "@/lib/game/exercises";
import { GENERATED_EXERCISE_DESCRIPTIONS } from "@/lib/game/generated/puzzles.generated";
import {
  dailyStarsStorageKey,
  labyrinthBestStorageKey,
  milestoneStorageKey,
  pieceProgressStorageKey,
} from "@/lib/lite-progress-storage";
import type { Exercise } from "@/lib/game/types";
import { getMilestoneStore } from "@/lib/progression/milestone-storage";
import { markMilestonesSeeded } from "@/lib/progression/seed-milestones";

/**
 * The claim is scoped to `step.piece`. The RE-RESOLVE must be too.
 *
 * `piece-badge-eligible:rook` is persisted the instant it is earned and stays
 * PENDING until the player dismisses it — persistence precedes rendering, so a
 * kill/reload with the overlay up is a fully supported state. The player comes
 * back, switches to BISHOP, solves a bishop exercise, and the queue re-surfaces
 * the rook closer (`buildCelebrationQueue` finds it by id; it does not filter by
 * the selected piece). They tap CLAIM: rook is minted on-chain.
 *
 * The bug this file locks down: the success path forced `badgeClaimed: true`
 * into a resolve that gathered every OTHER input for `selectedPiece`. Since
 * `mastery` gates on `badgeClaimed && allLabyrinthsComplete` with NO star
 * requirement, a bishop with its labyrinths done got a MASTERY crown on a badge
 * that was never minted — and `mastery:bishop` was persisted CELEBRATED, eating
 * the real bishop crown forever.
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

const CHAIN_ID = 42220;
const WALLET = "0x1111111111111111111111111111111111111111" as const;
const BADGES = "0x2222222222222222222222222222222222222222" as const;
const TX_HASH = "0x3333333333333333333333333333333333333333333333333333333333333333" as const;

/** Connected, on the configured chain, with the badge read ANSWERED — the shape
 *  `isMilestoneSeedReady` demands before anything may seed or resolve. */
vi.mock("wagmi", async (importOriginal) => {
  const actual = await importOriginal<typeof import("wagmi")>();
  return {
    ...actual,
    useAccount: () => ({
      address: WALLET,
      isConnected: true,
      status: "connected" as const,
    }),
    useChainId: () => CHAIN_ID,
    useWriteContract: () => ({ writeContractAsync: vi.fn(), isPending: false, reset: vi.fn() }),
    useReadContracts: () => ({
      data: Array.from({ length: 6 }, () => ({ result: false, status: "success" as const })),
      refetch: vi.fn(),
    }),
  };
});

vi.mock("@/lib/contracts/chains", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/contracts/chains")>();
  return {
    ...actual,
    getConfiguredChainId: () => CHAIN_ID,
    getBadgesAddress: () => BADGES,
  };
});

const claim = vi.hoisted(() => {
  let settle: ((outcome: unknown) => void) | null = null;
  return {
    run: vi.fn(
      () =>
        new Promise((resolve) => {
          settle = resolve;
        }),
    ),
    confirm: () =>
      settle?.({ status: "success", txHash: TX_HASH, receipt: { status: "success" } }),
  };
});

vi.mock("@/lib/exercises/use-onchain-write", () => ({
  useOnChainWrite: () => ({
    phase: "idle" as const,
    txHash: null,
    outcome: null,
    isBusy: false,
    run: claim.run,
    reset: vi.fn(),
  }),
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

/** Rook: five one-move exercises along the files. */
const ROOK_POOL: Exercise[] = [1, 2, 3, 4, 5].map((n) => ({
  id: `t-rook-${n}`,
  startPos: { file: 0, rank: n - 1 },
  targetPos: { file: 7, rank: n - 1 },
  optimalMoves: 1,
}));

/** Bishop: five one-move DIAGONALS (a1→h8, a2→g8, …). */
const BISHOP_POOL: Exercise[] = [1, 2, 3, 4, 5].map((n) => ({
  id: `t-bishop-${n}`,
  startPos: { file: 0, rank: n - 1 },
  targetPos: { file: 8 - n, rank: 7 },
  optimalMoves: 1,
}));

const ROOK_LABS: Exercise[] = [
  { id: "t-rook-lab-1", startPos: { file: 0, rank: 0 }, targetPos: { file: 7, rank: 0 }, optimalMoves: 1 },
];
const BISHOP_LABS: Exercise[] = [
  { id: "t-bishop-lab-1", startPos: { file: 0, rank: 0 }, targetPos: { file: 7, rank: 7 }, optimalMoves: 1 },
];

function renderScreen() {
  return renderWithAppProviders(
    <ContentCatalogProvider
      value={{
        exercises: { ...EXERCISES, rook: ROOK_POOL, bishop: BISHOP_POOL },
        labyrinths: { ...LABYRINTHS, rook: ROOK_LABS, bishop: BISHOP_LABS },
        descriptions: GENERATED_EXERCISE_DESCRIPTIONS,
      }}
    >
      <ExercisesScreen initialPiece="bishop" />
    </ContentCatalogProvider>,
  );
}

function solve(exercise: Exercise) {
  const from = `Square ${String.fromCharCode(97 + exercise.startPos.file)}${exercise.startPos.rank + 1}`;
  const to = `Square ${String.fromCharCode(97 + exercise.targetPos.file)}${exercise.targetPos.rank + 1}`;
  fireEvent.click(screen.getByRole("gridcell", { name: from }));
  fireEvent.click(screen.getByRole("gridcell", { name: to }));
}

/** The WELL DONE flash now holds for the player's tap before the queued
 *  recognition takes the stage (founder 2026-07-17). Wait for the prompt to
 *  arm, then tap past it. */
async function tapPastWellDone() {
  await screen.findByText("Tap to Continue", undefined, { timeout: 2500 });
  fireEvent.click(screen.getByRole("button", { name: "Tap to Continue" }));
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/** The store as the player left it: rook's badge moment EARNED and still
 *  PENDING (the kill/reload), everything older already recognized. */
function seedStore() {
  const now = new Date().toISOString();
  localStorage.setItem(
    milestoneStorageKey(),
    JSON.stringify({
      version: 1,
      dailyDate: today(),
      events: {
        "first-reward": { id: "first-reward", earnedAt: now, celebratedAt: now },
        "special-training": { id: "special-training", earnedAt: now, celebratedAt: now },
        "first-labyrinth:rook": {
          id: "first-labyrinth",
          piece: "rook",
          earnedAt: now,
          celebratedAt: now,
        },
        "first-labyrinth:bishop": {
          id: "first-labyrinth",
          piece: "bishop",
          earnedAt: now,
          celebratedAt: now,
        },
        // THE pending closer. Rook, not bishop.
        "piece-badge-eligible:rook": {
          id: "piece-badge-eligible",
          piece: "rook",
          earnedAt: now,
        },
      },
    }),
  );
}

/** Rook: 15★, badge-eligible, every labyrinth solved — the crown is one claim
 *  away. Bishop: 6★ (never badge-eligible), but its labyrinths ARE solved, so
 *  a `badgeClaimed: true` leaking onto bishop is all `mastery` would need. */
function seedProgress() {
  localStorage.setItem(
    pieceProgressStorageKey("rook"),
    JSON.stringify({
      piece: "rook",
      currentId: "t-rook-1",
      stars: {
        "t-rook-1": 3,
        "t-rook-2": 3,
        "t-rook-3": 3,
        "t-rook-4": 3,
        "t-rook-5": 3,
      },
    }),
  );
  localStorage.setItem(
    pieceProgressStorageKey("bishop"),
    JSON.stringify({
      piece: "bishop",
      currentId: "t-bishop-3",
      stars: { "t-bishop-1": 3, "t-bishop-2": 3 },
    }),
  );
  localStorage.setItem(
    labyrinthBestStorageKey("rook"),
    JSON.stringify({ "t-rook-lab-1": 1 }),
  );
  localStorage.setItem(
    labyrinthBestStorageKey("bishop"),
    JSON.stringify({ "t-bishop-lab-1": 1 }),
  );
  localStorage.setItem(
    dailyStarsStorageKey(),
    JSON.stringify({ date: today(), stars: 0 }),
  );
}

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem("chesscito:onboarded", "true");
  markMilestonesSeeded();
  seedStore();
  seedProgress();
  claim.run.mockClear();
});

afterEach(() => {
  cleanup();
});

describe("a badge claimed for a piece OTHER than the one on screen", () => {
  it("crowns the piece the chain minted, and never the selected one", async () => {
    renderScreen();

    // A bishop solve re-surfaces the rook closer: the queue finds
    // `piece-badge-eligible` by id, with no regard for `selectedPiece`.
    solve(BISHOP_POOL[2]);
    await tapPastWellDone();
    expect(await screen.findByText("Badge Ready to Claim")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Claim Badge" }));
    expect(claim.run).toHaveBeenCalledTimes(1);

    await act(async () => {
      claim.confirm();
    });

    const events = getMilestoneStore().events;

    // (a) The false crown. Bishop's badge was never minted; bishop's labyrinths
    // are done; a `badgeClaimed: true` evaluated against BISHOP would have
    // fired — and PERSISTED — a mastery it has not earned.
    expect(events["mastery:bishop"]).toBeUndefined();
    expect(events["piece-badge-claimed:bishop"]).toBeUndefined();

    // (b) The real one. Rook is what the chain confirmed, so rook is what the
    // machine must evaluate.
    expect(events["mastery:rook"]).toBeDefined();
    expect(events["piece-badge-claimed:rook"]).toBeDefined();
  });

  it("RENDERS the crown instead of stamping it — the dismiss precedes the re-resolve", async () => {
    renderScreen();

    solve(BISHOP_POOL[2]);
    await tapPastWellDone();
    await screen.findByText("Badge Ready to Claim");
    fireEvent.click(screen.getByRole("button", { name: "Claim Badge" }));
    await act(async () => {
      claim.confirm();
    });

    // Order is load-bearing. `resolve()` REPLACES the queue: re-resolving
    // BEFORE the dismiss would rebuild it headed by `mastery` with the badge
    // step absorbed into it, and the following `dismissCurrent()` would stamp
    // the crown celebrated WITHOUT EVER RENDERING IT. The player would lose the
    // biggest moment in the game to a line-ordering slip, silently.
    expect(screen.getByText("Piece Mastered")).toBeInTheDocument();
    expect(document.querySelectorAll('[aria-modal="true"]')).toHaveLength(1);

    // Still awaiting its dismissal — earned, shown, not yet recognized.
    expect(getMilestoneStore().events["mastery:rook"]?.celebratedAt).toBeUndefined();
    // And the badge moment it replaced IS recognized: dismissed, not lost.
    expect(
      getMilestoneStore().events["piece-badge-eligible:rook"]?.celebratedAt,
    ).toBeDefined();
  });
});
