/**
 * Regression guard for handleBack selector flash (2026-05-27 fix — commit 12489b06).
 *
 * Bug: When the user tapped BACK during an active game, the page briefly
 * mounted DifficultySelector for ~1 frame before navigating to root.
 *
 * Root cause: handleBack() called resetArenaState() + game.reset() before
 * handleBackToHub(). game.reset() flipped game.status to "selecting"
 * synchronously, causing the selector branch to re-render before
 * router.push("/") completed.
 *
 * Fix: Remove resetArenaState() + game.reset() from handleBack. Direct
 * router.push("/") is sufficient. Unmount cleanup of /arena already
 * recovers refs and resets game state via useEffect returns.
 *
 * This describe block replaces the tautology (expect(true).toBe(true)) that
 * shipped with the original fix. It mocks useChessGame + useRouter and
 * renders the full ArenaPage to assert the three invariants:
 *   1. router.push called with "/"
 *   2. arena-difficulty-selector test-id absent from DOM
 *   3. game.reset NOT called
 */

import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import React from "react";

// ---------------------------------------------------------------------------
// Core navigation mock — overrides the global vitest.setup.ts stub so that
// pushMock is our controlled spy rather than next/navigation's useRouter.
// ---------------------------------------------------------------------------
const pushMock = vi.fn();
vi.mock("@/i18n/navigation", () => ({
  useRouter: () => ({
    push: pushMock,
    back: vi.fn(),
    refresh: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
  Link: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  usePathname: () => "/arena",
  redirect: (path: string) => path,
  getPathname: ({ href }: { href: string }) => href,
}));

// ---------------------------------------------------------------------------
// Chess game hook — fixed to "checkmate" so isEndState is true on mount.
// ---------------------------------------------------------------------------
const resetMock = vi.fn();
vi.mock("@/lib/game/use-chess-game", () => ({
  useChessGame: () => ({
    status: "checkmate",
    isThinking: false,
    pieces: [],
    selectedSquare: null,
    legalMoves: [],
    lastMove: null,
    checkSquare: null,
    rejectingSquare: null,
    pendingPromotion: null,
    difficulty: "easy",
    playerColor: "w",
    moveCount: 12,
    moveHistory: ["e4"],
    elapsedMs: 60_000,
    gameStartedAt: 1_700_000_000_000,
    errorMessage: null,
    fen: "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1",
    selectSquare: vi.fn(),
    promoteWith: vi.fn(),
    cancelPromotion: vi.fn(),
    reset: resetMock,
    resign: vi.fn(),
    setDifficulty: vi.fn(),
    setPlayerColor: vi.fn(),
    startGame: vi.fn(),
  }),
}));

// ---------------------------------------------------------------------------
// wagmi — no wallet connected, no chain reads needed
// ---------------------------------------------------------------------------
vi.mock("wagmi", () => ({
  useAccount: () => ({ address: undefined, isConnected: false }),
  useDisconnect: () => ({ disconnect: vi.fn() }),
  useChainId: () => 42220,
  useReadContract: () => ({ data: undefined, isLoading: false }),
  useReadContracts: () => ({ data: [], isLoading: false }),
  useWriteContract: () => ({ writeContractAsync: vi.fn(), isPending: false }),
  useSignTypedData: () => ({ signTypedDataAsync: vi.fn() }),
  usePublicClient: () => undefined,
  useWaitForTransactionReceipt: () => ({ data: undefined, isLoading: false }),
}));

// ---------------------------------------------------------------------------
// next-intl client hooks
// ---------------------------------------------------------------------------
vi.mock("next-intl", () => ({
  // `.raw` is part of next-intl's translator contract (Identity Lite reads the
  // nickname template through it). Without it the mock lies about the API and
  // any consumer of useDisplayName throws.
  useTranslations: () =>
    Object.assign((k: string) => k, { raw: (k: string) => k }),
  useLocale: () => "en",
}));

// ---------------------------------------------------------------------------
// next/navigation (used by useSearchParams inside ArenaPage Suspense wrapper)
// ---------------------------------------------------------------------------
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/arena",
  useRouter: () => ({
    push: pushMock,
    back: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  }),
}));

// ---------------------------------------------------------------------------
// RainbowKit — connect modal not needed
// ---------------------------------------------------------------------------
vi.mock("@/lib/wallet/use-connect-wallet", () => ({
  useConnectWallet: () => ({ connectWallet: vi.fn(), isConnecting: false }),
}));

// ---------------------------------------------------------------------------
// Lottie — jsdom has no canvas; stub the wrapper used across arena components
// ---------------------------------------------------------------------------
vi.mock("@/components/ui/lottie-animation", () => ({
  LottieAnimation: () => null,
}));

// ---------------------------------------------------------------------------
// Heavy child components — stub to null so we avoid their own dep trees.
// The test only needs the back button rendered by ArenaHud.
// ---------------------------------------------------------------------------
vi.mock("@/components/arena/arena-board", () => ({ ArenaBoard: () => null }));
vi.mock("@/components/arena/arena-entry-panel", () => ({ ArenaEntryPanel: () => null }));
vi.mock("@/components/arena/arena-select-scaffold", () => ({ ArenaSelectScaffold: () => null }));
vi.mock("@/components/arena/coach-preview-card", () => ({ CoachPreviewCard: () => null }));
vi.mock("@/components/arena/arena-action-bar", () => ({ ArenaActionBar: () => null }));
vi.mock("@/components/arena/promotion-overlay", () => ({ PromotionOverlay: () => null }));
vi.mock("@/components/arena/arena-end-state", () => ({ ArenaEndState: () => null }));
vi.mock("@/components/exercises/persistent-dock", () => ({ PersistentDock: () => null }));
vi.mock("@/components/exercises/badge-sheet", () => ({ BadgeSheet: () => null }));
vi.mock("@/components/exercises/leaderboard-sheet", () => ({ LeaderboardSheet: () => null }));
vi.mock("@/components/exercises/purchase-confirm-sheet", () => ({ PurchaseConfirmSheet: () => null }));
vi.mock("@/components/exercises/shop-sheet", () => ({ ShopSheet: () => null }));
vi.mock("@/components/exercises/trophies-sheet", () => ({ TrophiesSheet: () => null }));
vi.mock("@/components/pro/pro-sheet", () => ({ ProSheet: () => null }));
vi.mock("@/components/coach/coach-loading", () => ({ CoachLoading: () => null }));
vi.mock("@/components/coach/coach-panel", () => ({ CoachPanel: () => null }));
vi.mock("@/components/coach/coach-fallback", () => ({ CoachFallback: () => null }));
vi.mock("@/components/coach/luz-onboarding-panel", () => ({ LuzOnboardingPanel: () => null }));
vi.mock("@/components/coach/coach-history", () => ({ CoachHistory: () => null }));
vi.mock("@/components/connect-prompt/connect-prompt-toast", () => ({ ConnectPromptToast: () => null }));
vi.mock("@/components/redesign/tx-progress-steps", () => ({ TxProgressSteps: () => null }));
vi.mock("@/components/redesign/candy-glass-shell", () => ({
  CandyGlassShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock("@/components/scene-rooted/gem", () => ({ GemButton: () => null }));

// ---------------------------------------------------------------------------
// Lib stubs — hooks and utilities that reach out to wagmi / fetch / storage
// ---------------------------------------------------------------------------
vi.mock("@/lib/connect-prompt/use-connect-prompt", () => ({
  useConnectPrompt: () => ({ show: vi.fn(), dismiss: vi.fn(), isVisible: false }),
}));
vi.mock("@/lib/pro/use-pro-status", () => ({
  useProStatus: () => ({ isProActive: false, isLoading: false }),
}));
vi.mock("@/lib/pro/use-pro-sheet-state", () => ({
  useProSheetState: () => ({ isOpen: false, open: vi.fn(), close: vi.fn() }),
}));
vi.mock("@/lib/badges/use-badge-sheet-state", () => ({
  useBadgeSheetState: () => ({ isOpen: false, open: vi.fn(), close: vi.fn() }),
}));
vi.mock("@/lib/shop/use-shop-sheet-state", () => ({
  useShopSheetState: () => ({ isOpen: false, open: vi.fn(), close: vi.fn(), activeItem: null }),
}));
// registerDockSheetOpener / registerDockSheetCloser return an unregister fn;
// the page calls it in useEffect cleanup — must return a real function.
vi.mock("@/lib/ui/dock-sheet-store", () => ({
  registerDockSheetCloser: vi.fn(() => vi.fn()),
  registerDockSheetOpener: vi.fn(() => vi.fn()),
  setDockSheet: vi.fn(),
}));
vi.mock("@/lib/haptics", () => ({
  hapticImpact: vi.fn(),
  hapticSuccess: vi.fn(),
  hapticTap: vi.fn(),
}));
vi.mock("@/lib/telemetry", () => ({
  track: vi.fn(),
}));
vi.mock("@/lib/coach/analyze-telemetry", () => ({
  trackAnalyzeRequest: vi.fn(),
  trackAnalyzeIdempotentHit: vi.fn(),
  trackAnalyzeFailed: vi.fn(),
}));
vi.mock("@/lib/coach/request-coach-analyze", () => ({
  requestCoachAnalyze: vi.fn(),
}));
vi.mock("@/lib/coach/fallback-engine", () => ({
  generateQuickReview: vi.fn(),
}));
vi.mock("@/lib/coach/paywall-gate", () => ({
  shouldShowPaywall: () => false,
}));
vi.mock("@/lib/coach/onboarding-outcome", () => ({
  gameStatusToOnboardingOutcome: () => "won",
}));
vi.mock("@/lib/coach/coach-preview-route", () => ({
  routeCoachPreviewCta: vi.fn(),
}));
vi.mock("@/lib/game/has-progress", () => ({
  hasAnyPieceProgress: () => false,
}));
vi.mock("@/lib/contracts/transaction-helpers", () => ({
  waitForReceiptWithTimeout: vi.fn(),
}));
vi.mock("@/lib/contracts/select-payment-token", () => ({
  selectMaxBalanceToken: vi.fn(),
}));

// ---------------------------------------------------------------------------
// ArenaHud renders the back button — keep the real implementation so the
// button is actually present in the DOM.
// ---------------------------------------------------------------------------

import ArenaPage from "../page";
import { ARENA_GAME_KEY } from "@/lib/game/arena-persistence";

describe("arena/handleBack — no selector flash (regression for 2026-05-27 fix)", () => {
  beforeEach(() => {
    pushMock.mockReset();
    resetMock.mockReset();
    window.localStorage.clear();
  });

  it("BACK during isEndState navigates to root WITHOUT mounting DifficultySelector first and without calling game.reset", async () => {
    render(<ArenaPage />);

    // With isEndState=true, ArenaBackChip skips the confirm state and fires
    // onBack immediately on the first click (no QUIT? intermediate step).
    // The aria-label key is "backToHubAria" (useTranslations returns the key
    // in test mode when next-intl is mocked to (k) => k).
    const backBtn = await screen.findByRole("button", { name: /backToHubAria/i });
    act(() => fireEvent.click(backBtn));

    expect(pushMock).toHaveBeenCalledWith("/");
    expect(screen.queryByTestId("arena-difficulty-selector")).toBeNull();
    expect(resetMock).not.toHaveBeenCalled();
  });

  // Leaving terminates the match like a resign: the persisted save is dropped
  // so re-entering /arena starts fresh instead of resuming at the exact second
  // the user walked away (2026-06-15 fix).
  it("BACK clears the persisted arena save so the match does not resume", async () => {
    window.localStorage.setItem(ARENA_GAME_KEY, JSON.stringify({ fen: "x", savedAt: 1 }));
    render(<ArenaPage />);

    const backBtn = await screen.findByRole("button", { name: /backToHubAria/i });
    act(() => fireEvent.click(backBtn));

    expect(window.localStorage.getItem(ARENA_GAME_KEY)).toBeNull();
    expect(pushMock).toHaveBeenCalledWith("/");
  });
});
