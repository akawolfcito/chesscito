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
  it("win + unminted: shows Ask Coach, Mint, Play Again. No View NFT. No Share.", () => {
    render(<GameActionsBar {...baseProps} />);
    expect(screen.getByRole("button", { name: /askCoach/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /mintVictory/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /playAgain/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /viewNft/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /^share$/ })).toBeNull();
  });

  it("win + minted: Mint gone, Share secondary present, View NFT demoted to tertiary", () => {
    // 2026-05-29 (Cluster C, commit 3a): post-mint, the primary CTA
    // shifts to Ask Coach (or Play Again if analysis already done) and
    // View NFT moves to a tertiary text link. The Mint button is no
    // longer rendered for this state.
    render(
      <GameActionsBar
        {...baseProps}
        mintedTokenId="42"
        shareLinkUrl="https://chesscito.com/v/42"
      />,
    );
    expect(screen.queryByRole("button", { name: /^mintVictory$/ })).toBeNull();
    expect(screen.getByRole("button", { name: /^share$/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /viewNft/ })).toBeInTheDocument();
    // Primary now reads askCoach (hasAnalysis defaults to false).
    expect(screen.getByRole("button", { name: /^askCoach$/ })).toBeInTheDocument();
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

  it("Mint calls onMint when win + unminted", () => {
    const onMint = vi.fn();
    render(<GameActionsBar {...baseProps} onMint={onMint} />);
    fireEvent.click(screen.getByRole("button", { name: /mintVictory/ }));
    expect(onMint).toHaveBeenCalledOnce();
  });

  it("View NFT calls onViewNft when minted", () => {
    const onViewNft = vi.fn();
    render(
      <GameActionsBar
        {...baseProps}
        mintedTokenId="42"
        shareLinkUrl="https://x"
        onViewNft={onViewNft}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /viewNft/ }));
    expect(onViewNft).toHaveBeenCalledOnce();
  });
});
