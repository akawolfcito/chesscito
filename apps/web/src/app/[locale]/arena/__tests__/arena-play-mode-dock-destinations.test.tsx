/**
 * PR5 — Play mode dock destinations on /arena.
 *
 * In Play mode, the dock's "badge" and "leaderboard" slugs must mount
 * PlayBadgesSheet / PlayLeadersSheet, never Learn's piece-badge BadgeSheet
 * or the training LeaderboardSheet. Full mode's branch (the existing
 * BadgeSheet/LeaderboardSheet) must be untouched — verified by the
 * existing test suite in this directory, which still passes unmodified.
 *
 * Mirrors the comprehensive mocking convention established in
 * arena-handle-back-no-flash.test.tsx, adapted to the "selecting" game
 * status (the branch this task's dock+sheets edits live in) and to
 * mocking @/lib/feature-flags so isPlayMode() reports true.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";

vi.mock("@/lib/feature-flags", () => ({ isPlayMode: () => true }));

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

vi.mock("@/lib/game/use-chess-game", () => ({
  useChessGame: () => ({
    status: "selecting",
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
    moveCount: 0,
    moveHistory: [],
    elapsedMs: 0,
    gameStartedAt: 1_700_000_000_000,
    errorMessage: null,
    fen: "start",
    selectSquare: vi.fn(),
    promoteWith: vi.fn(),
    cancelPromotion: vi.fn(),
    reset: vi.fn(),
    resign: vi.fn(),
    setDifficulty: vi.fn(),
    setPlayerColor: vi.fn(),
    startGame: vi.fn(),
  }),
}));

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

vi.mock("next-intl", () => ({
  // `.raw` is part of next-intl's translator contract (Identity Lite reads the
  // nickname template through it). Without it the mock lies about the API and
  // any consumer of useDisplayName throws.
  useTranslations: () =>
    Object.assign((k: string) => k, { raw: (k: string) => k }),
  useLocale: () => "en",
}));

// Controllable per-test so both the scaffold variant (default) and the
// legacy variant (?arena=legacy) branches of the dock+sheets JSX can be
// exercised — the page duplicates that block once per variant.
const searchParamsMock = vi.fn(() => new URLSearchParams());
vi.mock("next/navigation", () => ({
  useSearchParams: () => searchParamsMock(),
  usePathname: () => "/arena",
  useRouter: () => ({
    push: pushMock,
    back: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  }),
}));

vi.mock("@/lib/wallet/use-connect-wallet", () => ({
  useConnectWallet: () => ({ connectWallet: vi.fn(), isConnecting: false }),
}));

vi.mock("@/components/arena/arena-board", () => ({ ArenaBoard: () => null }));
vi.mock("@/components/arena/arena-entry-panel", () => ({ ArenaEntryPanel: () => null }));
vi.mock("@/components/arena/arena-select-scaffold", () => ({
  ArenaSelectScaffold: () => <div data-testid="arena-select-scaffold" />,
}));
vi.mock("@/components/arena/coach-preview-card", () => ({ CoachPreviewCard: () => null }));
vi.mock("@/components/arena/arena-action-bar", () => ({ ArenaActionBar: () => null }));
vi.mock("@/components/arena/promotion-overlay", () => ({ PromotionOverlay: () => null }));
vi.mock("@/components/arena/arena-end-state", () => ({ ArenaEndState: () => null }));
vi.mock("@/components/exercises/persistent-dock", () => ({ PersistentDock: () => null }));

// The components under test for this task — stub to identifiable markers
// so the assertions can tell which branch of the ternary rendered.
vi.mock("@/components/exercises/badge-sheet", () => ({
  BadgeSheet: () => <div data-testid="mock-badge-sheet" />,
}));
vi.mock("@/components/exercises/leaderboard-sheet", () => ({
  LeaderboardSheet: () => <div data-testid="mock-leaderboard-sheet" />,
}));
vi.mock("@/components/play/play-badges-sheet", () => ({
  PlayBadgesSheet: () => <div data-testid="mock-play-badges-sheet" />,
}));
vi.mock("@/components/play/play-leaders-sheet", () => ({
  PlayLeadersSheet: () => <div data-testid="mock-play-leaders-sheet" />,
}));

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

vi.mock("@/lib/connect-prompt/use-connect-prompt", () => ({
  useConnectPrompt: () => ({ show: vi.fn(), dismiss: vi.fn(), isVisible: false }),
}));
vi.mock("@/lib/pro/use-pro-status", () => ({
  useProStatus: () => ({ isProActive: false, isLoading: false }),
}));
vi.mock("@/lib/pro/use-pro-sheet-state", () => ({
  useProSheetState: () => ({ open: false, sheetProps: {}, openSheet: vi.fn(), closeSheet: vi.fn() }),
}));
vi.mock("@/lib/badges/use-badge-sheet-state", () => ({
  useBadgeSheetState: () => ({
    open: false,
    openSheet: vi.fn(),
    closeSheet: vi.fn(),
    badgesClaimed: {},
    sheetProps: { open: false, onOpenChange: vi.fn() },
  }),
}));
vi.mock("@/lib/shop/use-shop-sheet-state", () => ({
  useShopSheetState: () => ({
    open: false,
    openSheet: vi.fn(),
    closeSheet: vi.fn(),
    sheetProps: { open: false, onOpenChange: vi.fn() },
    confirmProps: { open: false, onOpenChange: vi.fn() },
    isCorrectChain: true,
    isConnected: false,
    onConnectWallet: vi.fn(),
    onSwitchNetwork: vi.fn(),
  }),
}));
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
vi.mock("@/lib/telemetry", () => ({ track: vi.fn() }));
vi.mock("@/lib/coach/analyze-telemetry", () => ({
  trackAnalyzeRequest: vi.fn(),
  trackAnalyzeIdempotentHit: vi.fn(),
  trackAnalyzeFailed: vi.fn(),
}));
vi.mock("@/lib/coach/request-coach-analyze", () => ({ requestCoachAnalyze: vi.fn() }));
vi.mock("@/lib/coach/fallback-engine", () => ({ generateQuickReview: vi.fn() }));
vi.mock("@/lib/coach/paywall-gate", () => ({ shouldShowPaywall: () => false }));
vi.mock("@/lib/coach/onboarding-outcome", () => ({ gameStatusToOnboardingOutcome: () => "won" }));
vi.mock("@/lib/coach/coach-preview-route", () => ({ routeCoachPreviewCta: vi.fn() }));
vi.mock("@/lib/game/has-progress", () => ({ hasAnyPieceProgress: () => false }));
vi.mock("@/lib/contracts/transaction-helpers", () => ({ waitForReceiptWithTimeout: vi.fn() }));
vi.mock("@/lib/contracts/select-payment-token", () => ({ selectMaxBalanceToken: vi.fn() }));

import ArenaPage from "../page";

describe("arena/page — Play mode dock destinations", () => {
  beforeEach(() => {
    pushMock.mockReset();
    searchParamsMock.mockReturnValue(new URLSearchParams());
    window.localStorage.clear();
  });

  it("scaffold variant: mounts PlayBadgesSheet and PlayLeadersSheet, not BadgeSheet/LeaderboardSheet", async () => {
    render(<ArenaPage />);

    await screen.findByTestId("arena-select-scaffold");

    expect(screen.getByTestId("mock-play-badges-sheet")).toBeInTheDocument();
    expect(screen.getByTestId("mock-play-leaders-sheet")).toBeInTheDocument();
    expect(screen.queryByTestId("mock-badge-sheet")).not.toBeInTheDocument();
    expect(screen.queryByTestId("mock-leaderboard-sheet")).not.toBeInTheDocument();
  });

  it("legacy variant (?arena=legacy): mounts PlayBadgesSheet and PlayLeadersSheet, not BadgeSheet/LeaderboardSheet", async () => {
    searchParamsMock.mockReturnValue(new URLSearchParams("arena=legacy"));
    render(<ArenaPage />);

    // The legacy variant renders ArenaEntryPanel (mocked to null) instead of
    // the scaffold — wait on one of the dock markers instead of a scaffold
    // test-id.
    await screen.findByTestId("mock-play-badges-sheet");

    expect(screen.getByTestId("mock-play-badges-sheet")).toBeInTheDocument();
    expect(screen.getByTestId("mock-play-leaders-sheet")).toBeInTheDocument();
    expect(screen.queryByTestId("mock-badge-sheet")).not.toBeInTheDocument();
    expect(screen.queryByTestId("mock-leaderboard-sheet")).not.toBeInTheDocument();
  });
});
