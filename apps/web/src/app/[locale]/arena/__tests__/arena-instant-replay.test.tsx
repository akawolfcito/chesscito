/**
 * INSTANT REPLAY — `handlePlayAgain` starts a match, it does not shop.
 *
 * Before 2026-08-28 this handler was `resetArenaState(); game.reset()`, which
 * set status to "selecting" and dropped the player on the DUEL selector. The
 * label said "PLAY"; the tap produced a configuration screen. Measured over
 * 1.885 `play_again_tap` in the 2026-07-23 → 2026-08-28 window: only
 * 51,8%–63,8% reached a game inside 5 minutes and 14,4%–28,3% never started
 * another game at all. docs/audits/2026-08-28-core-loop-diagnostic.md §C.5.
 *
 * The invariants pinned here:
 *
 *   1. PLAY AGAIN calls `startGame()` and NEVER `reset()`. `reset()` is what
 *      surfaces the selector — asserting its absence is asserting "no
 *      selector" at the only place the distinction actually exists.
 *   2. The 1.800 ms matchup transition SURVIVES. The brief was explicitly
 *      "no teleport": the replay must still feel like one duel ending and
 *      another beginning, so startGame is deferred, not immediate.
 *   3. "Change difficulty" keeps the OLD behaviour (`reset()` → selector).
 *      Losing this would make the difficulty unreachable, since the replay
 *      silently reuses the previous one.
 *   4. The X exits to the PLAY hub and never to /coach or /arena.
 *   5. `arena_game_start` carries a `game_id`, and the replay emits
 *      `play_again_game_started` on ARRIVAL at the board.
 */

import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import React from "react";

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

const resetMock = vi.fn();
const startGameMock = vi.fn();
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
    difficulty: "hard",
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
    startGame: startGameMock,
  }),
}));

vi.mock("wagmi", () => ({
  useAccount: () => ({ address: undefined, isConnected: false }),
  useDisconnect: () => ({ disconnect: vi.fn() }),
  useChainId: () => 42220,
  useSignMessage: () => ({ signMessageAsync: async () => "0x" }),
  useReadContract: () => ({ data: undefined, isLoading: false }),
  useReadContracts: () => ({ data: [], isLoading: false }),
  useWriteContract: () => ({ writeContractAsync: vi.fn(), isPending: false }),
  useSignTypedData: () => ({ signTypedDataAsync: vi.fn() }),
  usePublicClient: () => undefined,
  useWaitForTransactionReceipt: () => ({ data: undefined, isLoading: false }),
}));

vi.mock("next-intl", () => ({
  useTranslations: () =>
    Object.assign((k: string) => k, { raw: (k: string) => k }),
  useLocale: () => "en",
}));

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

vi.mock("@/lib/wallet/use-connect-wallet", () => ({
  useConnectWallet: () => ({ connectWallet: vi.fn(), isConnecting: false }),
}));
vi.mock("@/components/ui/lottie-animation", () => ({
  LottieAnimation: () => null,
}));

/**
 * ArenaEndState is stubbed into three raw buttons that expose the handlers
 * under test. This deliberately does NOT assert the popup's markup — that is
 * arena-end-state-replay-loop.test.tsx's job. Here we only care what the PAGE
 * does when each handler fires.
 */
vi.mock("@/components/arena/arena-end-state", () => ({
  ArenaEndState: ({
    onPlayAgain,
    onChangeDifficulty,
    onClose,
  }: {
    onPlayAgain: () => void;
    onChangeDifficulty?: () => void;
    onClose?: () => void;
  }) => (
    <div>
      <button type="button" onClick={onPlayAgain}>stub-play-again</button>
      <button type="button" onClick={onChangeDifficulty}>stub-change-difficulty</button>
      <button type="button" onClick={onClose}>stub-close</button>
    </div>
  ),
}));

vi.mock("@/components/arena/arena-board", () => ({ ArenaBoard: () => null }));
vi.mock("@/components/arena/arena-entry-panel", () => ({ ArenaEntryPanel: () => null }));
vi.mock("@/components/arena/arena-select-scaffold", () => ({ ArenaSelectScaffold: () => null }));
vi.mock("@/components/arena/coach-preview-card", () => ({ CoachPreviewCard: () => null }));
vi.mock("@/components/arena/arena-action-bar", () => ({ ArenaActionBar: () => null }));
vi.mock("@/components/arena/promotion-overlay", () => ({ PromotionOverlay: () => null }));
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
  useProSheetState: () => ({ isOpen: false, open: vi.fn(), close: vi.fn() }),
}));
vi.mock("@/lib/badges/use-badge-sheet-state", () => ({
  useBadgeSheetState: () => ({ isOpen: false, open: vi.fn(), close: vi.fn() }),
}));
vi.mock("@/lib/shop/use-shop-sheet-state", () => ({
  useShopSheetState: () => ({ isOpen: false, open: vi.fn(), close: vi.fn(), activeItem: null }),
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

const trackMock = vi.fn();
vi.mock("@/lib/telemetry", () => ({
  track: (...args: unknown[]) => trackMock(...args),
}));

vi.mock("@/lib/coach/analyze-telemetry", () => ({
  trackAnalyzeRequest: vi.fn(),
  trackAnalyzeIdempotentHit: vi.fn(),
  trackAnalyzeFailed: vi.fn(),
}));
vi.mock("@/lib/coach/request-coach-analyze", () => ({ requestCoachAnalyze: vi.fn() }));
vi.mock("@/lib/coach/fallback-engine", () => ({ generateQuickReview: vi.fn() }));
vi.mock("@/lib/coach/paywall-gate", () => ({ shouldShowPaywall: () => false }));
vi.mock("@/lib/coach/coach-preview-route", () => ({ routeCoachPreviewCta: vi.fn() }));
vi.mock("@/lib/game/has-progress", () => ({ hasAnyPieceProgress: () => false }));
vi.mock("@/lib/contracts/transaction-helpers", () => ({ waitForReceiptWithTimeout: vi.fn() }));
vi.mock("@/lib/contracts/select-payment-token", () => ({ selectMaxBalanceToken: vi.fn() }));

import ArenaPage from "../page";

/** Mirrors MATCHUP_TRANSITION_MS in page.tsx. */
const MATCHUP_TRANSITION_MS = 1800;

function eventsNamed(name: string) {
  return trackMock.mock.calls.filter(([event]) => event === name);
}

async function tapEndStateButton(label: string) {
  render(<ArenaPage />);
  const btn = await screen.findByText(label);
  act(() => {
    fireEvent.click(btn);
  });
}

beforeEach(() => {
  pushMock.mockReset();
  resetMock.mockReset();
  startGameMock.mockReset();
  trackMock.mockReset();
  window.localStorage.clear();
  vi.useFakeTimers({ shouldAdvanceTime: true });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("arena — PLAY AGAIN starts a match without the selector", () => {
  it("does NOT call game.reset() (reset is what renders the selector)", async () => {
    await tapEndStateButton("stub-play-again");
    expect(resetMock).not.toHaveBeenCalled();
  });

  it("keeps the 1.800 ms matchup transition before the board", async () => {
    await tapEndStateButton("stub-play-again");

    // Nothing yet — the transition is deliberately preserved.
    expect(startGameMock).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(MATCHUP_TRANSITION_MS);
    });
    expect(startGameMock).toHaveBeenCalledTimes(1);
  });

  it("emits arena_game_start carrying a game_id and the carried-over difficulty", async () => {
    await tapEndStateButton("stub-play-again");

    const starts = eventsNamed("arena_game_start");
    expect(starts).toHaveLength(1);
    const props = starts[0][1] as Record<string, unknown>;
    // The id is what finally lets a start be paired with its end.
    expect(props.game_id).toEqual(expect.any(String));
    expect(String(props.game_id)).not.toHaveLength(0);
    // Difficulty carries over from the finished match — no reconfiguration.
    expect(props.difficulty).toBe("hard");
  });

  it("emits play_again_game_started only once the board is reached", async () => {
    await tapEndStateButton("stub-play-again");

    // Intent has fired, arrival has not.
    expect(eventsNamed("play_again_game_started")).toHaveLength(0);

    act(() => {
      vi.advanceTimersByTime(MATCHUP_TRANSITION_MS);
    });

    const arrived = eventsNamed("play_again_game_started");
    expect(arrived).toHaveLength(1);
    const props = arrived[0][1] as Record<string, unknown>;
    expect(props.difficulty).toBe("hard");
    expect(props.new_game_id).toEqual(expect.any(String));
  });

  it("does not re-emit play_again_game_started on later timer ticks", async () => {
    await tapEndStateButton("stub-play-again");
    act(() => {
      vi.advanceTimersByTime(MATCHUP_TRANSITION_MS * 4);
    });
    expect(eventsNamed("play_again_game_started")).toHaveLength(1);
  });
});

describe("arena — Change difficulty is the reconfigure path", () => {
  it("calls game.reset() so the DUEL selector renders", async () => {
    await tapEndStateButton("stub-change-difficulty");
    expect(resetMock).toHaveBeenCalledTimes(1);
  });

  it("never starts a match on its own", async () => {
    await tapEndStateButton("stub-change-difficulty");
    act(() => {
      vi.advanceTimersByTime(MATCHUP_TRANSITION_MS * 2);
    });
    expect(startGameMock).not.toHaveBeenCalled();
    expect(eventsNamed("arena_game_start")).toHaveLength(0);
  });
});

describe("arena — the X exits to the PLAY hub", () => {
  it("pushes to '/' and never into the Match Reviewer or the selector", async () => {
    await tapEndStateButton("stub-close");

    expect(pushMock).toHaveBeenCalledWith("/");
    for (const [href] of pushMock.mock.calls) {
      expect(String(href)).not.toContain("/coach");
      expect(String(href)).not.toContain("/arena");
    }
  });

  it("still reports the close through arena_x_close_fired", async () => {
    await tapEndStateButton("stub-close");
    const closes = eventsNamed("arena_x_close_fired");
    expect(closes).toHaveLength(1);
    expect(closes[0][1]).toMatchObject({ effect_type: "push", effect_href: "/" });
  });
});
