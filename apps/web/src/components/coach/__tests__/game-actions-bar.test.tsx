import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

import { GameActionsBar } from "../game-actions-bar";

const baseProps = {
  gameId: "g1",
  result: "win" as const,
  totalMoves: 12,
  hasAnalysis: false,
  hasPartialReplayError: false,
  mintedTokenId: null as string | null,
  shareLinkUrl: null as string | null,
  onAskCoach: vi.fn(),
  onMint: vi.fn(),
  onShare: vi.fn(),
  onPlayAgain: vi.fn(),
  onViewNft: vi.fn(),
  onBackToHub: vi.fn(),
};

describe("GameActionsBar", () => {
  it("win + unminted: shows Save Victory primary, Ask Coach + Play Again secondaries", () => {
    // 2026-05-29 (Cluster C, commit 3b): the Mint primary is now the
    // treasure-sprite Save Victory CTA. Aria-label uses the new
    // `saveVictory` / `saveVictoryAriaLabel` keys; the price ribbon
    // appears when `claimPrice` is provided.
    render(<GameActionsBar {...baseProps} claimPrice="$0.005" />);
    expect(screen.getByRole("button", { name: /saveVictory/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /askCoach/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /playAgain/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /viewNft/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /^share$/ })).toBeNull();
  });

  it("win + minted: Mint gone, Share trophy tile present, View on Celoscan tertiary", () => {
    // 2026-05-29 (Cluster C, M3): post-mint, the actions row renders
    // 3 tiles — Play Again + Share trophy + Ask Coach — with View on
    // Celoscan as the tertiary text link below. Save Victory is gone
    // (already claimed); Share is the "shareTrophy" key (distinct
    // from arena's legacy "share").
    render(
      <GameActionsBar
        {...baseProps}
        mintedTokenId="42"
        shareLinkUrl="https://chesscito.com/v/42"
      />,
    );
    expect(screen.queryByRole("button", { name: /^mintVictory$/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /^saveVictory$/ })).toBeNull();
    expect(screen.getByRole("button", { name: /shareTrophy/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /viewOnCeloscan/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^askCoach$/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^playAgain$/ })).toBeInTheDocument();
  });

  it("loss: no Mint, no Share, Ask Coach + Play Again", () => {
    render(<GameActionsBar {...baseProps} result="lose" />);
    expect(screen.queryByRole("button", { name: /mintVictory/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /^share$/ })).toBeNull();
    expect(screen.getByRole("button", { name: /askCoach/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /playAgain/ })).toBeInTheDocument();
  });

  it("draw: no Mint, no Share, Ask Coach + Play Again", () => {
    render(<GameActionsBar {...baseProps} result="draw" />);
    expect(screen.queryByRole("button", { name: /mintVictory/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /^share$/ })).toBeNull();
  });

  it("resigned: no Mint, no Share", () => {
    render(<GameActionsBar {...baseProps} result="resigned" />);
    expect(screen.queryByRole("button", { name: /mintVictory/ })).toBeNull();
  });

  it("Ask Coach disabled when partial-replay error", () => {
    render(<GameActionsBar {...baseProps} hasPartialReplayError />);
    expect(screen.getByRole("button", { name: /askCoach/ })).toBeDisabled();
  });

  it("zero moves (too short): Ask Coach gone, Play Again is the only primary", () => {
    // 2026-05-29 (Cluster C, commit 3a): per spec §3.1, the too-short
    // state strips Ask Coach entirely — there is nothing to analyze.
    // The primary collapses to Play Again with a Back-to-Hub tertiary.
    render(<GameActionsBar {...baseProps} totalMoves={0} />);
    expect(screen.queryByRole("button", { name: /askCoach/ })).toBeNull();
    expect(screen.getByRole("button", { name: /playAgain/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /backToHub/ })).toBeInTheDocument();
  });

  it("Ask Coach label switches when hasAnalysis is true", () => {
    render(<GameActionsBar {...baseProps} hasAnalysis />);
    // Locale-mock returns key as text; label switches to askCoachAgain
    expect(screen.getByRole("button", { name: /askCoachAgain/ })).toBeInTheDocument();
  });

  it("Play Again calls onPlayAgain", () => {
    const onPlayAgain = vi.fn();
    render(<GameActionsBar {...baseProps} onPlayAgain={onPlayAgain} />);
    fireEvent.click(screen.getByRole("button", { name: /playAgain/ }));
    expect(onPlayAgain).toHaveBeenCalledOnce();
  });

  it("Save Victory calls onMint when win + unminted", () => {
    // The primary CTA renamed from Mint to Save Victory in commit 3b;
    // the callback still wires through `onMint` to keep the contract
    // page → bar boundary unchanged.
    const onMint = vi.fn();
    render(<GameActionsBar {...baseProps} onMint={onMint} claimPrice="$0.005" />);
    fireEvent.click(screen.getByRole("button", { name: /saveVictory/ }));
    expect(onMint).toHaveBeenCalledOnce();
  });

  it("View on Celoscan calls onViewNft when minted", () => {
    const onViewNft = vi.fn();
    render(
      <GameActionsBar
        {...baseProps}
        mintedTokenId="42"
        shareLinkUrl="https://x"
        onViewNft={onViewNft}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /viewOnCeloscan/ }));
    expect(onViewNft).toHaveBeenCalledOnce();
  });

  // 2026-05-30 (Bug #2 fix): pending state on Ask Coach tile.
  it("askCoachPending: tile shows analysisPending label and is disabled", () => {
    render(<GameActionsBar {...baseProps} askCoachPending />);
    // Label swapped to analysisPending key (mocked-intl returns the key)
    const tile = screen.getByRole("button", { name: /analysisPending/ });
    expect(tile).toBeInTheDocument();
    expect(tile).toBeDisabled();
    expect(tile).toHaveAttribute("aria-busy", "true");
    expect(tile).toHaveAttribute("data-loading", "true");
  });

  it("askCoachPending: does NOT fire onAskCoach when clicked", () => {
    const onAskCoach = vi.fn();
    render(
      <GameActionsBar {...baseProps} onAskCoach={onAskCoach} askCoachPending />,
    );
    fireEvent.click(screen.getByRole("button", { name: /analysisPending/ }));
    expect(onAskCoach).not.toHaveBeenCalled();
  });

  it("askCoachPending false: normal askCoach label, no aria-busy", () => {
    render(<GameActionsBar {...baseProps} askCoachPending={false} />);
    const tile = screen.getByRole("button", { name: /askCoach/ });
    expect(tile).not.toBeDisabled();
    expect(tile).not.toHaveAttribute("aria-busy");
    expect(tile).not.toHaveAttribute("data-loading");
  });

  // 2026-05-30 (Phase 2 shop oscuridad): point-of-use credits hint.
  it("renders credits hint when coachCredits > 0 and Ask Coach is reachable", () => {
    render(<GameActionsBar {...baseProps} result="lose" coachCredits={4} />);
    expect(screen.getByRole("status")).toHaveTextContent(/creditsHint/);
  });

  it("hides credits hint when coachCredits is 0", () => {
    render(<GameActionsBar {...baseProps} result="lose" coachCredits={0} />);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("hides credits hint when coachCredits is undefined", () => {
    render(<GameActionsBar {...baseProps} result="lose" />);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("hides credits hint while Ask Coach is pending", () => {
    render(
      <GameActionsBar
        {...baseProps}
        result="lose"
        coachCredits={4}
        askCoachPending
      />,
    );
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("hides credits hint when too-short (Ask Coach absent)", () => {
    render(
      <GameActionsBar {...baseProps} totalMoves={0} coachCredits={4} />,
    );
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("hides credits hint on partial replay error (Ask Coach disabled)", () => {
    render(
      <GameActionsBar
        {...baseProps}
        result="lose"
        coachCredits={4}
        hasPartialReplayError
      />,
    );
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});
