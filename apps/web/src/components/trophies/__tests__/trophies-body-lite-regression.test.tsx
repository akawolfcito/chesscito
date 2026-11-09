import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderWithIntl as render, screen } from "@/test-utils/render-with-intl";
import type { DailyProgress } from "@/lib/daily/progress";

/**
 * Regression tests for the Codex PASS-WITH-NOTES audit on Lite Achievements.
 *
 * Fix landed in trophies-body.tsx line 197:
 *   if (!configured && !CHESSCITO_LITE_MODE)
 *
 * Rationale: Lite Achievements derive from local DailyProgress and must not
 * be blocked by the legacy victories-contract configuration check.
 * Full path preserves the original early-return fallback.
 *
 * Coverage:
 *   1. Lite + no contract → 3 tiles render, hero shows 0/3, no legacy fallback
 *   2. Hero band → 0/3 · 1/3 · 2/3 · 3/3 based on DailyProgress
 */

// ---------------------------------------------------------------------------
// Feature flag: Lite ON
// ---------------------------------------------------------------------------
vi.mock("@/lib/feature-flags", () => ({ CHESSCITO_LITE_MODE: true }));

// No victories contract configured — the condition that previously broke Lite.
vi.mock("@/lib/game/victory-events", () => ({
  getVictoryAddress: () => null,
}));

vi.mock("wagmi", () => ({
  useAccount: () => ({ address: undefined, isConnected: false }),
  useSignMessage: () => ({ signMessageAsync: vi.fn() }),
}));

vi.mock("@/lib/wallet/use-connect-wallet", () => ({
  useConnectWallet: () => ({ connectWallet: vi.fn(), isConnecting: false }),
}));

vi.mock("@/components/trophies/trophies-data-provider", () => ({
  useTrophiesData: () => ({
    victories: [],
    loading: false,
    error: null,
    reload: vi.fn(),
  }),
  clearOptimisticVictory: vi.fn(),
  getOptimisticVictory: vi.fn(() => null),
  toVictoryEntry: vi.fn(),
}));

vi.mock("@/lib/coach/use-coach-history-count", () => ({
  useCoachHistoryCount: () => ({ rowCount: 0, isLoading: false, refetch: vi.fn() }),
}));

// Injectable progress for hero band tests.
let mockProgress: DailyProgress = { streak: 0, lastCompletedDate: null, totalCompleted: 0 };
vi.mock("@/lib/daily/progress", () => ({
  getDailyProgress: () => mockProgress,
}));

// This suite never earns first-great-session — it exercises the
// first-focus-day / streak-driven achievements only. An empty store keeps
// deriveLiteAchievements' 4th slot unearned across every case here.
vi.mock("@/lib/progression/milestone-storage", () => ({
  getMilestoneStore: () => ({ version: 1, events: {}, dailyDate: null }),
}));

import { TrophiesBody, TrophiesHeroBand } from "../trophies-body";

// ---------------------------------------------------------------------------
// 1. TrophiesBody — Lite without victories contract
// ---------------------------------------------------------------------------
describe("TrophiesBody — Lite without victories contract", () => {
  beforeEach(() => {
    mockProgress = { streak: 0, lastCompletedDate: null, totalCompleted: 0 };
  });

  it("renders the 4 Lite achievement titles", () => {
    render(<TrophiesBody />);
    expect(screen.getByText("First Focus Day")).toBeInTheDocument();
    expect(screen.getByText("First Great Session")).toBeInTheDocument();
    expect(screen.getByText("3-Day Rhythm")).toBeInTheDocument();
    expect(screen.getByText("7-Day Focus")).toBeInTheDocument();
  });

  it("shows '0/4 ACHIEVEMENTS' in the hero band when there is no daily progress", () => {
    render(<TrophiesBody />);
    // Exact string match avoids collision with the '0/3' progress bar inside
    // the three-day-rhythm tile (progress.current/progress.goal).
    expect(screen.getByText("0/4 ACHIEVEMENTS")).toBeInTheDocument();
  });

  it("does NOT render the legacy 'Trophies are offline' fallback", () => {
    render(<TrophiesBody />);
    expect(screen.queryByText("Trophies are offline")).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// 2. TrophiesHeroBand — Lite hero achievement count (0/3 → 3/3)
// ---------------------------------------------------------------------------
describe("TrophiesHeroBand — Lite hero achievement count", () => {
  beforeEach(() => {
    mockProgress = { streak: 0, lastCompletedDate: null, totalCompleted: 0 };
  });

  it("shows '0/4 ACHIEVEMENTS' when no daily progress", async () => {
    render(<TrophiesHeroBand />);
    // Use findByText to let the getDailyProgress useEffect flush.
    expect(await screen.findByText("0/4 ACHIEVEMENTS")).toBeInTheDocument();
  });

  it("shows '1/4 ACHIEVEMENTS' when totalCompleted=1 (first day done)", async () => {
    mockProgress = { streak: 1, lastCompletedDate: null, totalCompleted: 1 };
    render(<TrophiesHeroBand />);
    expect(await screen.findByText("1/4 ACHIEVEMENTS")).toBeInTheDocument();
    expect(screen.getByText("1 SESSIONS")).toBeInTheDocument();
  });

  it("shows '2/4 ACHIEVEMENTS' when streak=3 (first + rhythm done)", async () => {
    mockProgress = { streak: 3, lastCompletedDate: null, totalCompleted: 3 };
    render(<TrophiesHeroBand />);
    expect(await screen.findByText("2/4 ACHIEVEMENTS")).toBeInTheDocument();
  });

  it("shows '3/4 ACHIEVEMENTS' when streak=7 (first + rhythm + week done, great session not tracked here)", async () => {
    mockProgress = { streak: 7, lastCompletedDate: null, totalCompleted: 7 };
    render(<TrophiesHeroBand />);
    expect(await screen.findByText("3/4 ACHIEVEMENTS")).toBeInTheDocument();
  });

  it("uses the Lite hero copy from the Spanish bundle", async () => {
    render(<TrophiesHeroBand />, { locale: "es" });
    expect(await screen.findByText("TU PROGRESO")).toBeInTheDocument();
    expect(screen.getByText("0/4 LOGROS")).toBeInTheDocument();
    expect(screen.getByText("Completa sesiones diarias de enfoque para avanzar.")).toBeInTheDocument();
  });
});
