import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

// Spy on the real Coach analysis trigger. The whole point of this fix is
// that mounting the viewer must NOT call askCoach — only an explicit tap.
const askCoachMock = vi.hoisted(() => vi.fn());
const useCoachAnalysisMock = vi.hoisted(() => vi.fn());
const useIsProActiveMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/coach/use-coach-analysis", () => ({
  useCoachAnalysis: (...args: unknown[]) => useCoachAnalysisMock(...args),
}));
vi.mock("@/lib/pro/use-is-pro-active", () => ({
  useIsProActive: () => useIsProActiveMock(),
}));
vi.mock("@/lib/coach/use-mint-victory", () => ({
  useMintVictory: () => ({
    phase: "idle",
    data: { tokenId: null, claimTxHash: null, shareCardUrl: null, shareLinkUrl: null },
    start: vi.fn(),
    reset: vi.fn(),
  }),
}));

type CoachState = ReturnType<typeof useCoachAnalysisMock>;
function coachState(over: Partial<CoachState> = {}): CoachState {
  return {
    phase: "idle",
    response: null,
    fallbackResponse: null,
    credits: 0,
    analysisLocale: "en",
    historyMeta: null,
    askCoach: askCoachMock,
    ...over,
  } as CoachState;
}

const pushMock = vi.fn();
const backMock = vi.fn();
vi.mock("@/i18n/navigation", () => ({
  useRouter: () => ({ push: pushMock, back: backMock, refresh: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  Link: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => "en",
}));

vi.mock("wagmi", () => ({
  useAccount: () => ({ address: undefined, isConnected: false }),
  useChainId: () => 42220,
  useReadContract: () => ({ data: undefined, isLoading: false }),
  useReadContracts: () => ({ data: [], isLoading: false }),
  useWriteContract: () => ({ writeContractAsync: vi.fn() }),
  useSignTypedData: () => ({ signTypedDataAsync: vi.fn() }),
  usePublicClient: () => undefined,
}));

vi.mock("@/components/coach/game-viewer", () => ({
  GameViewer: ({ moves }: { moves: string[] }) => (
    <div data-testid="game-viewer" data-move-count={moves.length} />
  ),
}));

vi.mock("@/components/coach/game-actions-bar", () => ({
  GameActionsBar: ({
    onPlayAgain,
    onAskCoach,
    result,
    mintedTokenId,
    hasAnalysis,
    proActive,
    askCoachPending,
  }: {
    onPlayAgain: () => void;
    onAskCoach: () => void;
    result: string;
    mintedTokenId: string | null;
    hasAnalysis: boolean;
    proActive?: boolean;
    askCoachPending?: boolean;
  }) => (
    <div
      data-testid="game-actions-bar"
      data-result={result}
      data-minted={String(mintedTokenId)}
      data-has-analysis={String(hasAnalysis)}
      data-pro-active={String(proActive)}
      data-ask-pending={String(askCoachPending)}
    >
      <button data-testid="play-again-btn" onClick={onPlayAgain}>play again</button>
      <button data-testid="ask-coach-btn" onClick={onAskCoach}>ask coach</button>
    </div>
  ),
}));

vi.mock("@/components/connect-prompt/connect-prompt-toast", () => ({
  ConnectPromptToast: () => <div data-testid="connect-prompt-toast">connect prompt</div>,
}));

vi.mock("@/components/coach/coach-panel", () => ({
  CoachPanel: () => <div data-testid="coach-panel">coach panel</div>,
}));

vi.mock("@/components/coach/coach-fallback", () => ({
  CoachFallback: () => <div data-testid="coach-fallback">coach fallback</div>,
}));

import { CoachGameClient } from "../coach-game-client";

const baseRecord = {
  gameId: "550e8400-e29b-41d4-a716-446655440000",
  moves: ["e4", "e5"],
  result: "win" as const,
  difficulty: "easy" as const,
  totalMoves: 2,
  elapsedMs: 30_000,
  timestamp: Date.now(),
};

const WALLET = "0x1111111111111111111111111111111111111111" as const;

describe("CoachGameClient", () => {
  beforeEach(() => {
    askCoachMock.mockReset();
    useIsProActiveMock.mockReturnValue(false);
    useCoachAnalysisMock.mockReturnValue(coachState());
  });

  it("renders viewer + actions for a valid record", () => {
    render(
      <CoachGameClient
        gameRecord={baseRecord}
        walletAddress={"0x1111111111111111111111111111111111111111" as const}
      />,
    );
    expect(screen.getByTestId("game-viewer")).toBeInTheDocument();
    expect(screen.getByTestId("game-actions-bar")).toBeInTheDocument();
  });

  it("Play Again pushes /arena?fresh=1", () => {
    pushMock.mockReset();
    render(
      <CoachGameClient
        gameRecord={baseRecord}
        walletAddress={"0x1111111111111111111111111111111111111111" as const}
      />,
    );
    fireEvent.click(screen.getByTestId("play-again-btn"));
    expect(pushMock).toHaveBeenCalledWith("/arena?fresh=1");
  });

  it("wallet missing: renders ConnectPromptToast", () => {
    render(<CoachGameClient gameRecord={baseRecord} walletAddress={undefined} />);
    expect(screen.getByTestId("connect-prompt-toast")).toBeInTheDocument();
    expect(screen.queryByTestId("game-viewer")).toBeNull();
  });

  it("gameRecord null: renders load-error fallback with Play Again CTA", () => {
    pushMock.mockReset();
    render(
      <CoachGameClient
        gameRecord={null}
        walletAddress={"0x1111111111111111111111111111111111111111" as const}
      />,
    );
    expect(screen.getByText(/loadErrorTitle/i)).toBeInTheDocument();
    const btn = screen.getByRole("button", { name: /playAgain/i });
    fireEvent.click(btn);
    expect(pushMock).toHaveBeenCalledWith("/arena?fresh=1");
  });

  it("gameRecord with analysis (full kind): renders CoachPanel inline", () => {
    const recordWithFull = {
      ...baseRecord,
      analysis: {
        gameId: baseRecord.gameId,
        provider: "server" as const,
        analysisVersion: "1",
        createdAt: Date.now(),
        response: { kind: "full" as const, summary: "ok", mistakes: [], lessons: [], praise: [] },
      },
    };
    render(
      <CoachGameClient
        gameRecord={recordWithFull}
        walletAddress={"0x1111111111111111111111111111111111111111" as const}
      />,
    );
    expect(screen.getByTestId("coach-panel")).toBeInTheDocument();
  });

  it("gameRecord with analysis (quick kind): renders CoachFallback inline", () => {
    const recordWithQuick = {
      ...baseRecord,
      analysis: {
        gameId: baseRecord.gameId,
        provider: "server" as const,
        analysisVersion: "1",
        createdAt: Date.now(),
        response: { kind: "quick" as const, summary: "ok", tips: [] },
      },
    };
    render(
      <CoachGameClient
        gameRecord={recordWithQuick}
        walletAddress={"0x1111111111111111111111111111111111111111" as const}
      />,
    );
    expect(screen.getByTestId("coach-fallback")).toBeInTheDocument();
  });

  it("minted token shown via gameRecord.mintedTokenId", () => {
    const minted = { ...baseRecord, mintedTokenId: "42", claimTxHash: "0xabcd" as const, shareLinkUrl: "https://chesscito.com/v/42" };
    render(
      <CoachGameClient
        gameRecord={minted}
        walletAddress={"0x1111111111111111111111111111111111111111" as const}
      />,
    );
    const bar = screen.getByTestId("game-actions-bar");
    expect(bar.getAttribute("data-minted")).toBe("42");
  });

  // ---- Coach auto-run gate (audit 2026-06-09) ----

  it("mount (wallet + no cached analysis + idle): does NOT auto-run the Coach API", () => {
    render(<CoachGameClient gameRecord={baseRecord} walletAddress={WALLET} />);
    expect(askCoachMock).not.toHaveBeenCalled();
    // The explicit user-triggered CTA is present instead.
    expect(screen.getByTestId("ask-coach-btn")).toBeInTheDocument();
  });

  it("tapping Ask Coach runs the real flow (askCoach 'viewer')", () => {
    render(<CoachGameClient gameRecord={baseRecord} walletAddress={WALLET} />);
    fireEvent.click(screen.getByTestId("ask-coach-btn"));
    expect(askCoachMock).toHaveBeenCalledTimes(1);
    expect(askCoachMock).toHaveBeenCalledWith("viewer");
  });

  it("PRO wallet: mount does not auto-run; CTA shows proActive; tap fires", () => {
    useIsProActiveMock.mockReturnValue(true);
    render(<CoachGameClient gameRecord={baseRecord} walletAddress={WALLET} />);
    expect(askCoachMock).not.toHaveBeenCalled();
    expect(screen.getByTestId("game-actions-bar").getAttribute("data-pro-active")).toBe("true");
    fireEvent.click(screen.getByTestId("ask-coach-btn"));
    expect(askCoachMock).toHaveBeenCalledWith("viewer");
  });

  it("cached analysis: renders inline panel WITHOUT auto-running the API", () => {
    const recordWithFull = {
      ...baseRecord,
      analysis: {
        gameId: baseRecord.gameId,
        provider: "server" as const,
        analysisVersion: "1",
        createdAt: Date.now(),
        response: { kind: "full" as const, summary: "ok", mistakes: [], lessons: [], praise: [] },
      },
    };
    render(<CoachGameClient gameRecord={recordWithFull} walletAddress={WALLET} />);
    expect(screen.getByTestId("coach-panel")).toBeInTheDocument();
    expect(askCoachMock).not.toHaveBeenCalled();
  });

  it("post-cancel re-entry (cold-load, no analysis) does not auto-run", () => {
    // Simulates landing on /coach/[gameId] after cancelling Victory:
    // server ships no analysis, hook idle. Must stay silent.
    const { unmount } = render(<CoachGameClient gameRecord={baseRecord} walletAddress={WALLET} />);
    unmount();
    render(<CoachGameClient gameRecord={baseRecord} walletAddress={WALLET} />);
    expect(askCoachMock).not.toHaveBeenCalled();
  });

  it("local quick review (fallback phase) renders without auto-running the API", () => {
    useCoachAnalysisMock.mockReturnValue(
      coachState({
        phase: "fallback",
        fallbackResponse: { kind: "quick", summary: "ok", tips: [] },
      }),
    );
    render(<CoachGameClient gameRecord={baseRecord} walletAddress={WALLET} />);
    expect(screen.getByTestId("coach-fallback")).toBeInTheDocument();
    expect(askCoachMock).not.toHaveBeenCalled();
  });
});
