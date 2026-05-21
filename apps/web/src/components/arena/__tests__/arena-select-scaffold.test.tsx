import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { ArenaSelectScaffold } from "../arena-select-scaffold";
import { ARENA_COPY } from "@/lib/content/editorial";

// Anchor against the editorial single-source so the tests track future
// renames (PLAY CHESS → PLAY, Learn a piece → PIECES, etc.).
const START = ARENA_COPY.startMatch;
const SOFT_LEARN = ARENA_COPY.softGateLearn;
const SOFT_ENTER = ARENA_COPY.softGateEnter;

vi.mock("@/lib/haptics", () => ({
  hapticTap: () => {},
  hapticImpact: () => {},
  hapticSuccess: () => {},
}));

const baseProps = {
  difficulty: "easy" as const,
  playerColor: "w" as const,
  onSelectDifficulty: vi.fn(),
  onSelectColor: vi.fn(),
  onStart: vi.fn(),
};

describe("ArenaSelectScaffold", () => {
  it("renders the canonical 3-zone layout regions", () => {
    const { container } = render(<ArenaSelectScaffold {...baseProps} />);
    expect(container.querySelector(".arena-scaffold")).not.toBeNull();
    expect(container.querySelector(".arena-scaffold-body")).not.toBeNull();
    expect(container.querySelector(".arena-scaffold-footer")).not.toBeNull();
  });

  it("does not mount the KingdomAnchor arena-preview board", () => {
    const { container } = render(<ArenaSelectScaffold {...baseProps} />);
    expect(container.querySelector(".kingdom-anchor--arena-preview")).toBeNull();
  });

  it("mounts the MissionRibbon for the arena surface", () => {
    const { container } = render(<ArenaSelectScaffold {...baseProps} />);
    const ribbon = container.querySelector(".mission-ribbon");
    expect(ribbon).not.toBeNull();
    expect(ribbon?.className).toContain("mission-ribbon--arena");
  });

  it("mounts the PrimaryPlayCta for arena-entry surface", () => {
    const { container } = render(<ArenaSelectScaffold {...baseProps} />);
    expect(container.querySelector(".primary-play-cta--arena-entry")).not.toBeNull();
  });

  it("fires onSelectDifficulty when a difficulty pill is clicked", async () => {
    const onSelectDifficulty = vi.fn();
    render(
      <ArenaSelectScaffold {...baseProps} onSelectDifficulty={onSelectDifficulty} />,
    );
    await userEvent.click(screen.getByRole("button", { name: /Medium/i }));
    expect(onSelectDifficulty).toHaveBeenCalledWith("medium");
  });

  it("fires onSelectColor when the color toggle is clicked", async () => {
    const onSelectColor = vi.fn();
    render(<ArenaSelectScaffold {...baseProps} onSelectColor={onSelectColor} />);
    await userEvent.click(screen.getByRole("button", { name: /Play as Black/i }));
    expect(onSelectColor).toHaveBeenCalledWith("b");
  });

  it("fires onStart when the primary CTA is pressed", async () => {
    const onStart = vi.fn();
    render(<ArenaSelectScaffold {...baseProps} onStart={onStart} />);
    await userEvent.click(screen.getByRole("button", { name: START }));
    expect(onStart).toHaveBeenCalled();
  });

  it("fires onBack when the back chip is pressed", async () => {
    const onBack = vi.fn();
    render(<ArenaSelectScaffold {...baseProps} onBack={onBack} />);
    await userEvent.click(screen.getByRole("button", { name: /Back to Hub/i }));
    expect(onBack).toHaveBeenCalled();
  });

  it("does not render the back chip when onBack is omitted", () => {
    render(<ArenaSelectScaffold {...baseProps} />);
    expect(screen.queryByRole("button", { name: /Back to Hub/i })).toBeNull();
  });

  it("renders the soft-gate banner when softGate prop is provided", () => {
    render(
      <ArenaSelectScaffold
        {...baseProps}
        softGate={{ onLearn: vi.fn(), onDismiss: vi.fn() }}
      />,
    );
    expect(screen.getByText(/Want a warm-up first/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: SOFT_LEARN })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: SOFT_ENTER })).toBeInTheDocument();
  });

  it("collapses the soft-gate banner when softGate prop is omitted", () => {
    render(<ArenaSelectScaffold {...baseProps} />);
    expect(screen.queryByText(/Want a warm-up first/i)).toBeNull();
  });

  it("renders the prize pool pill when prizePool is provided", () => {
    render(
      <ArenaSelectScaffold
        {...baseProps}
        prizePool={{ formatted: "$12.34", isLoading: false }}
      />,
    );
    expect(screen.getByLabelText(/Community prize pool/i)).toBeInTheDocument();
    expect(screen.getByText(/\$12\.34/)).toBeInTheDocument();
  });

  it("renders the prize pool loading state", () => {
    render(
      <ArenaSelectScaffold
        {...baseProps}
        prizePool={{ formatted: null, isLoading: true }}
      />,
    );
    expect(screen.getByText(/Loading pool/i)).toBeInTheDocument();
  });

  it("renders the non-PRO Coach hint without blocking Play", async () => {
    // Post-refactor: CoachReviewSignal collapsed from a sales-y banner
    // into a single candy pill labeled "Coach · REVIEW" (non-PRO) /
    // "PRO · REVIEW" (active). The whole pill is the CTA; we click it
    // directly via the testid for the non-PRO onCta path.
    const onCta = vi.fn();
    const onStart = vi.fn();
    render(
      <ArenaSelectScaffold
        {...baseProps}
        onStart={onStart}
        coachSignal={{ proActive: false, onCta }}
      />,
    );

    const signal = screen.getByTestId("coach-review-signal");
    expect(signal).toHaveTextContent("Coach");
    expect(signal).toHaveTextContent("REVIEW");
    await userEvent.click(signal);
    expect(onCta).toHaveBeenCalledTimes(1);
    await userEvent.click(screen.getByRole("button", { name: START }));
    expect(onStart).toHaveBeenCalledTimes(1);
  });

  it("renders the active PRO Coach hint without sales copy", () => {
    render(
      <ArenaSelectScaffold
        {...baseProps}
        coachSignal={{ proActive: true, onCta: vi.fn() }}
      />,
    );

    const signal = screen.getByTestId("coach-review-signal");
    expect(signal).toHaveTextContent("PRO");
    expect(signal).toHaveTextContent("REVIEW");
    // The PRO pill is informational (no onClick), so the legacy sales
    // CTAs must NOT render in either variant.
    expect(screen.queryByRole("button", { name: /Open Journal/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Train with Coach/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/PRO unlocks/i)).not.toBeInTheDocument();
  });

  it("renders an error message banner when errorMessage is provided", () => {
    render(<ArenaSelectScaffold {...baseProps} errorMessage="AI disconnected" />);
    expect(screen.getByText("AI disconnected")).toBeInTheDocument();
  });

  it("reflects the active difficulty via aria-pressed", () => {
    render(<ArenaSelectScaffold {...baseProps} difficulty="hard" />);
    const hard = screen.getByRole("button", { name: /Hard/i });
    expect(hard).toHaveAttribute("aria-pressed", "true");
  });

  it("reflects the active color via aria-pressed", () => {
    render(<ArenaSelectScaffold {...baseProps} playerColor="b" />);
    const black = screen.getByRole("button", { name: /Play as Black/i });
    expect(black).toHaveAttribute("aria-pressed", "true");
  });
});
