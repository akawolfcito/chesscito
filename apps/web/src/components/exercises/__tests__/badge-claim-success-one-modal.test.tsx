import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, screen, within } from "@testing-library/react";

import { renderWithAppProviders } from "@/test-utils/render-with-app-providers";
import { ContentCatalogProvider } from "@/lib/content/catalog-context";
import { EXERCISES, LABYRINTHS } from "@/lib/game/exercises";
import { GENERATED_EXERCISE_DESCRIPTIONS } from "@/lib/game/generated/puzzles.generated";
import {
  dailyStarsStorageKey,
  milestoneStorageKey,
  pieceProgressStorageKey,
} from "@/lib/lite-progress-storage";
import type { Exercise } from "@/lib/game/types";
import { markMilestonesSeeded } from "@/lib/progression/seed-milestones";

/**
 * NEW-1 — the badge path with a claim that actually CONFIRMS.
 *
 * `celebration-order.test.tsx` drives the same screen, but with no wallet: every
 * claim there resolves `false` and no test advances the clock. That is exactly
 * the blind spot this file covers. On the real mainline path:
 *
 *   1. the 10th star mounts `<UnlockOverlay piece-badge-eligible>` AND arms the
 *      15s auto-reset that flips `showPieceComplete`;
 *   2. the MiniPay round trip easily outlives those 15s;
 *   3. the claim confirms → `applyBadgeClaimSuccess` sets `resultOverlay` +
 *      `unlockedPiece`, and the queue drains, all in the SAME commit.
 *
 * Every gate that was keyed only on `celebration.current === null` opened at
 * once → two `aria-modal` surfaces. The invariant is counted on
 * `[aria-modal="true"]`, never on `role="dialog"`: `<LabyrinthCompleteOverlay>`
 * passes `role="alert"` to the same shell, so counting roles would report green
 * on a visible stack.
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

/** A connected wallet on the configured chain — the preconditions
 *  `handleClaimBadge` demands before it will even call `run()`.
 *
 *  `status` and an ANSWERED badge read are not decoration: the seeding gate
 *  (`isMilestoneSeedReady`) is built from both. Mocking `useAccount` without
 *  `status` left `accountStatus` undefined, so the gate could never be true and
 *  this file passed only because `markMilestonesSeeded()` runs in `beforeEach`
 *  — it never exercised the gate it sits behind. Six `false` results = a real
 *  player with no badges claimed yet, which is exactly this scenario. */
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

/** The claim, held open on purpose. `run()` resolves only when the test settles
 *  it — that pending window is where the 15s auto-reset lands, exactly as a
 *  MiniPay signature + receipt does in the wild. */
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

/** THE invariant. Every popup on this screen is a `VictoryPopupShell` with
 *  `aria-modal="true"`, whatever `role` it passes. */
function modalCount(): number {
  return document.querySelectorAll('[aria-modal="true"]').length;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

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

/** 12★ over four exercises: the fifth (and last) solve makes it 15★ — the badge
 *  threshold, on the same tap that arms the 15s piece-complete timer. */
function seedNearBadge() {
  localStorage.setItem(
    pieceProgressStorageKey("rook"),
    JSON.stringify({
      piece: "rook",
      currentId: "t-rook-5",
      stars: { "t-rook-1": 3, "t-rook-2": 3, "t-rook-3": 3, "t-rook-4": 3 },
    }),
  );
  localStorage.setItem(
    dailyStarsStorageKey(),
    JSON.stringify({ date: today(), stars: 0 }),
  );
}

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem("chesscito:onboarded", "true");
  // Already on the milestone machine — the one-time migration (Task 15) has
  // run for this profile. Without the marker, mounting the screen would seed
  // this player's 12★ as history and suppress the badge moment under test.
  markMilestonesSeeded();
  claim.run.mockClear();
});

afterEach(() => {
  vi.useRealTimers();
  cleanup();
});

describe("a badge claim that CONFIRMS still leaves exactly one modal", () => {
  it("holds the piece-complete menu behind the badge result, then hands it over", async () => {
    seedCelebrated("first-reward", "first-labyrinth:rook", "special-training");
    seedNearBadge();
    renderScreen();

    // Fake timers only from here: the auto-reset is armed by THIS solve.
    vi.useFakeTimers();
    solve(ROOK_POOL[4]);

    // The badge path holds the WELL DONE flash for the player's tap
    // (2026-08-11); the recognition only mounts after it, and its 13.5s
    // safety-net now counts from the tap rather than from the solve.
    act(() => {
      vi.advanceTimersByTime(2_000);
    });
    expect(modalCount()).toBe(0);
    fireEvent.click(screen.getByRole("button", { name: "Tap to Continue" }));
    // The flash plays its exit before the recognition takes the stage; with the
    // clock frozen it has to be driven, or the assertion lands mid-transition.
    act(() => {
      vi.advanceTimersByTime(600);
    });

    expect(modalCount()).toBe(1);
    expect(screen.getByText("Badge Ready to Claim")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Claim Badge" }));
    expect(claim.run).toHaveBeenCalledTimes(1);

    // The wallet round trip outlives the auto-reset (1.5s + 13.5s). This is the
    // step that flips `showPieceComplete` behind the player's back.
    act(() => {
      vi.advanceTimersByTime(20_000);
    });

    // Still signing: the recognition owns the screen, alone.
    expect(modalCount()).toBe(1);
    expect(screen.getByText("Badge Ready to Claim")).toBeInTheDocument();

    // The chain rules. `applyBadgeClaimSuccess` sets `resultOverlay` +
    // `unlockedPiece` and the queue drains — all in the same commit.
    await act(async () => {
      claim.confirm();
    });

    expect(modalCount()).toBe(1);
    expect(screen.getByText("Badge Earned!")).toBeInTheDocument();
    // The bug: this used to un-gate in the same commit as the result card.
    expect(screen.queryByText("All Exercises Complete!")).not.toBeInTheDocument();

    // `ResultOverlay` plays a 250ms exit before it calls `onDismiss`, so the
    // card is still mounted for a beat after the tap. Even mid-exit the count
    // must hold at one: the next surface may not mount until this one is gone.
    fireEvent.click(screen.getByRole("button", { name: "CONTINUE" }));
    expect(modalCount()).toBe(1);
    expect(screen.getByText("Badge Earned!")).toBeInTheDocument();

    // Deferred, never swallowed — the continuation still arrives, one at a time.
    act(() => {
      vi.advanceTimersByTime(250);
    });
    expect(modalCount()).toBe(1);
    expect(screen.getByText("Bishop Unlocked!")).toBeInTheDocument();
    expect(screen.queryByText("All Exercises Complete!")).not.toBeInTheDocument();

    const unlocked = screen.getByRole("dialog");
    fireEvent.click(within(unlocked).getByRole("button", { name: "Close" }));

    expect(modalCount()).toBe(1);
    expect(screen.getByText("All Exercises Complete!")).toBeInTheDocument();
  });
});
