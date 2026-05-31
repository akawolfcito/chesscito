/**
 * Regression guard for arena PLAY timer resilience (2026-05-27).
 *
 * Spec: arena-play-timer-fragility memory entry (2026-05-25).
 * PLAY → setIsPreparing(true) → 400ms setTimeout → game.startGame().
 * Any useEffect with unstable refs in ArenaPageInner can collapse the
 * render gap and prevent PLAY from reaching the board.
 *
 * This test verifies that the T5a skeleton (unconditional useCoachAnalysis +
 * useCoachCreditsPurchase hook calls wired in arena/page.tsx) does NOT break
 * the page render. The full PLAY → playing assertion lands in T5b once
 * useCoachAnalysis carries real logic.
 */

import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { render } from "@testing-library/react";
import React from "react";

// ---------------------------------------------------------------------------
// Core navigation mock — mirrors arena-handle-back-no-flash.test.tsx exactly.
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
  useTranslations: () => (k: string) => k,
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
vi.mock("@rainbow-me/rainbowkit", () => ({
  useConnectModal: () => ({ openConnectModal: vi.fn() }),
}));

// ---------------------------------------------------------------------------
// Lottie — jsdom has no canvas; stub the wrapper used across arena components
// ---------------------------------------------------------------------------
vi.mock("@/components/ui/lottie-animation", () => ({
  LottieAnimation: () => null,
}));

// ---------------------------------------------------------------------------
// Heavy child components — stub to null so we avoid their own dep trees.
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
vi.mock("@/components/coach/coach-paywall", () => ({ CoachPaywall: () => null }));
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
vi.mock("@/lib/contracts/use-prize-pool", () => ({
  usePrizePoolBalance: () => ({ formatted: null, isLoading: false }),
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
// Subject under test
// ---------------------------------------------------------------------------
import ArenaPage from "../page";

describe("arena PLAY timer resilience (regression for arena-play-timer-fragility 2026-05-25)", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("ArenaPage mounts cleanly with extracted coach hooks active (T5 skeleton smoke)", () => {
    const { container } = render(<ArenaPage />);
    // Mounts without throwing. The real PLAY → playing assertion lands in
    // T5b once useCoachAnalysis has the actual logic — for now we verify
    // the new hook calls + flag wiring don't break the page render.
    expect(container).toBeTruthy();
  });
});
