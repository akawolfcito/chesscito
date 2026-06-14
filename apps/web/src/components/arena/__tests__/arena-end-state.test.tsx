import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

// Echo-mock: useTranslations returns the i18n key (ignores interpolation
// values) so assertions stay key-stable across copy edits.
vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

const trackMock = vi.fn();
vi.mock("@/lib/telemetry", () => ({
  track: (...args: unknown[]) => trackMock(...args),
}));

import { ArenaEndState, type ClaimData, type ClaimPhase } from "../arena-end-state";

const baseClaimData: ClaimData = {
  tokenId: null,
  claimTxHash: null,
  shareCardUrl: null,
  shareLinkUrl: null,
};

function renderLoss(overrides: Partial<React.ComponentProps<typeof ArenaEndState>> = {}) {
  const props: React.ComponentProps<typeof ArenaEndState> = {
    status: "resigned",
    isPlayerWin: false,
    onPlayAgain: vi.fn(),
    onBackToHub: vi.fn(),
    claimPhase: "ready" as ClaimPhase,
    shareStatus: "locked",
    claimData: baseClaimData,
    moves: 18,
    elapsedMs: 90000,
    difficulty: "easy",
    // Save tile prerequisites: a claimable, persisted mint.
    onClaimVictory: vi.fn(),
    gameRecordPersisted: true,
    claimPrice: "$0.50",
    ...overrides,
  };
  return { props, ...render(<ArenaEndState {...props} />) };
}

beforeEach(() => trackMock.mockClear());

describe("ArenaEndState — F8 phase (b) Save on loss/draw/resign", () => {
  it("renders the Save tile with the neutral 'saveMatch' label on a loss", () => {
    renderLoss();
    expect(screen.getByRole("button", { name: "saveMatchAriaLabel" })).toBeInTheDocument();
    expect(screen.getByText("saveMatch")).toBeInTheDocument();
    // Never the celebratory win label on a non-win outcome.
    expect(screen.queryByText("saveVictory")).not.toBeInTheDocument();
  });

  it("renders the Save tile for draw and stalemate too", () => {
    renderLoss({ status: "draw" });
    expect(screen.getByText("saveMatch")).toBeInTheDocument();
  });

  it("hides Save for a guest (no onClaimVictory wired)", () => {
    renderLoss({ onClaimVictory: undefined });
    expect(screen.queryByText("saveMatch")).not.toBeInTheDocument();
  });

  it("hides Save when the record has not persisted yet", () => {
    renderLoss({ gameRecordPersisted: false });
    expect(screen.queryByText("saveMatch")).not.toBeInTheDocument();
  });

  it("hides Save for a 0-move game (double-blocked with the contract)", () => {
    renderLoss({ moves: 0 });
    expect(screen.queryByText("saveMatch")).not.toBeInTheDocument();
  });

  it("on Save tap, fires save_victory_tap with the result and calls onClaimVictory", () => {
    const { props } = renderLoss({ status: "resigned" });
    fireEvent.click(screen.getByRole("button", { name: "saveMatchAriaLabel" }));
    expect(props.onClaimVictory).toHaveBeenCalledTimes(1);
    expect(trackMock).toHaveBeenCalledWith(
      "monetization.save_victory_tap",
      expect.objectContaining({ result: "resigned", context: "endgame_resign" }),
    );
  });

  it("shows the busy label while claiming and disables the button", () => {
    renderLoss({ claimPhase: "claiming" });
    const btn = screen.getByRole("button", { name: "saveMatchAriaLabel" });
    expect(btn).toBeDisabled();
    expect(screen.getByText("savingMatch")).toBeInTheDocument();
  });

  it("renders the neutral success toast and fires save_victory_success once on success", () => {
    renderLoss({
      claimPhase: "success",
      claimData: { ...baseClaimData, tokenId: 42n },
    });
    expect(screen.getByText("mintSavedToast")).toBeInTheDocument();
    expect(trackMock).toHaveBeenCalledWith(
      "monetization.save_victory_success",
      expect.objectContaining({ result: "resigned" }),
    );
  });

  it("renders an inline retry row on failure and retries on tap", () => {
    const { props } = renderLoss({ claimPhase: "error", claimError: "boom" });
    expect(screen.getByRole("alert")).toHaveTextContent("boom");
    fireEvent.click(screen.getByRole("button", { name: "saveRetry" }));
    expect(props.onClaimVictory).toHaveBeenCalledTimes(1);
  });
});
