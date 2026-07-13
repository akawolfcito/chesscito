/**
 * Guard for the arena BACK destination (2026-07-13).
 *
 * HISTORY — the 2026-05-27 "selector flash" fix (commit 12489b06) stripped
 * resetArenaState() + game.reset() out of handleBack because game.reset()
 * flipped status to "selecting" synchronously, flashing the selector on the
 * way OUT to the hub. That fix was correct *for a hub destination*.
 *
 * CHANGE — leaving a match now lands on the rival selector (`/arena?fresh=1`),
 * not the hub. The old flash concern dissolves: the selector is no longer a
 * frame glimpsed in transit, it IS the destination.
 *
 * Two traps this file exists to guard:
 *
 *   1. SAME-ROUTE NAV DOES NOT UNMOUNT. `/arena` → `/arena?fresh=1` re-renders
 *      the page; it does not remount it. handleBack can therefore NOT delegate
 *      cleanup to unmount effects (which is what the 2026-05-27 fix relied on).
 *      It must reset explicitly.
 *
 *   2. THE `?fresh=1` EFFECT IS SINGLE-SHOT PER MOUNT (`freshResetRef`,
 *      page.tsx). A player who ENTERED via `/arena?fresh=1` has already burned
 *      that ref. Pushing `?fresh=1` again would leave the URL unchanged and the
 *      ref spent — game.reset() would never fire and the player would be
 *      STRANDED in the finished match. handleBack must not depend on it.
 *
 * Invariants asserted below:
 *   1. router.push called with "/arena?fresh=1"
 *   2. game.reset IS called (explicitly — nothing else will do it)
 *   3. the persisted save is dropped (leaving == resign)
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

describe("arena/handleBack — leaving a match lands on the rival selector", () => {
  beforeEach(() => {
    pushMock.mockReset();
    resetMock.mockReset();
    window.localStorage.clear();
  });

  // The HUD back chip is labelled by its ACTION ("leave match"), not by a
  // destination — `backToHubAria` stays reserved for the surfaces that really
  // do go to the hub (selector scaffold, entry panel, end-state overlays).
  // useTranslations is mocked to (k) => k, so the key IS the accessible name.
  it("BACK on end-state navigates to the rival selector, not the hub", async () => {
    render(<ArenaPage />);

    // isEndState=true → ArenaBackChip fires onBack immediately (no confirm).
    const backBtn = await screen.findByRole("button", { name: /leaveMatchAria/i });
    act(() => fireEvent.click(backBtn));

    expect(pushMock).toHaveBeenCalledWith("/arena?fresh=1");
    expect(pushMock).not.toHaveBeenCalledWith("/");
  });

  // Trap 2 (see file header): the `?fresh=1` effect is single-shot per mount,
  // and this navigation does not remount. If handleBack leaned on that effect,
  // a player who entered via ?fresh=1 would never see the selector again.
  // handleBack must call game.reset() itself.
  it("BACK resets the game itself rather than relying on the ?fresh=1 effect", async () => {
    render(<ArenaPage />);

    const backBtn = await screen.findByRole("button", { name: /leaveMatchAria/i });
    act(() => fireEvent.click(backBtn));

    expect(resetMock).toHaveBeenCalled();
  });

  // Leaving terminates the match like a resign: the persisted save is dropped
  // so the selector does not resume the match the user just walked away from
  // (2026-06-15 fix, preserved).
  it("BACK clears the persisted arena save so the match does not resume", async () => {
    window.localStorage.setItem(ARENA_GAME_KEY, JSON.stringify({ fen: "x", savedAt: 1 }));
    render(<ArenaPage />);

    const backBtn = await screen.findByRole("button", { name: /leaveMatchAria/i });
    act(() => fireEvent.click(backBtn));

    expect(window.localStorage.getItem(ARENA_GAME_KEY)).toBeNull();
    expect(pushMock).toHaveBeenCalledWith("/arena?fresh=1");
  });
});
