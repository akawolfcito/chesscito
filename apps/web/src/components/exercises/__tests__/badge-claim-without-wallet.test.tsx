import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, screen } from "@testing-library/react";

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
 * The disconnected half of `badge-claim-success-one-modal.test.tsx`.
 *
 * `handleClaimBadge` used to return `false` in silence when there was no wallet
 * — no toast, no telemetry, no connect attempt — while every Claim CTA rendered
 * live and enabled anyway (`badgeClaimable` never looked at the wallet). The
 * player tapped and NOTHING happened. It was latent for as long as nothing sent
 * players to the badge; the completion overlay now does.
 *
 * The tap here goes through the `<UnlockOverlay piece-badge-eligible>` CTA,
 * which is the surface the completion path actually points at.
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
const BADGES = "0x2222222222222222222222222222222222222222" as const;

/** No wallet. The badge contract still resolves — the point is that the address
 *  is the ONLY thing missing, so nothing else can be blamed for the dead tap. */
vi.mock("wagmi", async (importOriginal) => {
  const actual = await importOriginal<typeof import("wagmi")>();
  return {
    ...actual,
    useAccount: () => ({
      address: undefined,
      isConnected: false,
      status: "disconnected" as const,
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

const claim = vi.hoisted(() => ({ run: vi.fn() }));

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

const track = vi.hoisted(() => vi.fn());
vi.mock("@/lib/telemetry", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/telemetry")>();
  return { ...actual, track };
});

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
  markMilestonesSeeded();
  claim.run.mockClear();
  track.mockClear();
});

afterEach(() => {
  vi.useRealTimers();
  cleanup();
});

describe("Claim Badge with no wallet says why, instead of nothing", () => {
  it("tells the player to connect, and never reaches the write", () => {
    seedCelebrated("first-reward", "first-labyrinth:rook", "special-training");
    seedNearBadge();
    renderScreen();

    solve(ROOK_POOL[4]);
    expect(screen.getByText("Badge Ready to Claim")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Claim Badge" }));

    // The reply the tap never had. Copy reused from CONNECT_PROMPT_COPY —
    // written for exactly this moment.
    expect(
      screen.getByText(
        "Badges are ready to claim. Connect your wallet to keep them.",
      ),
    ).toBeInTheDocument();

    // And the claim itself is still correctly refused: no signature request,
    // no write, no phantom "claiming" state.
    expect(claim.run).not.toHaveBeenCalled();
  });

  it("reports the refusal, so a dead tap is countable", () => {
    seedCelebrated("first-reward", "first-labyrinth:rook", "special-training");
    seedNearBadge();
    renderScreen();

    solve(ROOK_POOL[4]);
    fireEvent.click(screen.getByRole("button", { name: "Claim Badge" }));

    expect(track).toHaveBeenCalledWith("badge_claim_tx", {
      stage: "blocked",
      reason: "not_connected",
      piece: "rook",
    });
    // `stage: "start"` sits AFTER the guard: a blocked tap must not look like
    // an attempt in the funnel.
    expect(track).not.toHaveBeenCalledWith(
      "badge_claim_tx",
      expect.objectContaining({ stage: "start" }),
    );
  });
});
