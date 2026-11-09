import { describe, it, expect, vi } from "vitest";
import { renderWithIntl as render, screen } from "@/test-utils/render-with-intl";
import userEvent from "@testing-library/user-event";

import { ArenaSelectScaffold } from "../arena-select-scaffold";
import { ARENA_COPY } from "@/lib/content/editorial";

// Anchor against the editorial single-source so the tests track future
// renames (PLAY CHESS → PLAY, Learn a piece → PIECES, etc.).
const START = ARENA_COPY.startMatch;
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

  it("renders the soft-gate modal when softGate prop is provided", () => {
    const onDismiss = vi.fn();
    render(
      <ArenaSelectScaffold
        {...baseProps}
        softGate={{ onLearn: vi.fn(), onDismiss }}
      />,
    );
    // Sheet renders the title twice — once sr-only (Radix Dialog
    // a11y) and once as the visible <h2>. Both reflect the same
    // editorial copy, so assert at least one match.
    expect(screen.getAllByText(/Want a warm-up first/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByRole("button", { name: ARENA_COPY.softGateLearn })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: SOFT_ENTER })).toBeInTheDocument();
  });

  it("continues into Arena from the sole Warm Up CTA", async () => {
    const onDismiss = vi.fn();
    render(
      <ArenaSelectScaffold
        {...baseProps}
        softGate={{ onLearn: vi.fn(), onDismiss }}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: SOFT_ENTER }));
    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it("collapses the soft-gate banner when softGate prop is omitted", () => {
    render(<ArenaSelectScaffold {...baseProps} />);
    expect(screen.queryByText(/Want a warm-up first/i)).toBeNull();
  });

  it("does NOT render the Coach review chip — removed 2026-05-22 to declutter the selector", () => {
    render(<ArenaSelectScaffold {...baseProps} />);
    expect(screen.queryByTestId("coach-review-signal")).not.toBeInTheDocument();
    expect(screen.queryByText(/PRO/)).not.toBeInTheDocument();
  });

  it("renders the account pill (avatar + label) and fires onTap", async () => {
    const onTap = vi.fn();
    render(
      <ArenaSelectScaffold
        {...baseProps}
        account={{ isPro: false, daysRemaining: null, onTap }}
      />,
    );
    const chip = screen.getByTestId("arena-account-chip");
    expect(chip.className).toContain("candy-tray-pill");
    await userEvent.click(chip);
    expect(onTap).toHaveBeenCalledOnce();
  });

  it("adds the PRO text modifier + days suffix when account.isPro is true", () => {
    render(
      <ArenaSelectScaffold
        {...baseProps}
        account={{ isPro: true, daysRemaining: 200, onTap: vi.fn() }}
      />,
    );
    expect(screen.getByTestId("arena-account-chip").className).toContain(
      "hub-hud-pill--pro-text",
    );
    expect(screen.getByText(/PRO · 200d/)).toBeInTheDocument();
  });

  it("omits the account entry when the account prop is absent", () => {
    render(<ArenaSelectScaffold {...baseProps} />);
    expect(screen.queryByTestId("arena-account-chip")).toBeNull();
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

  it("leads each card with the rival persona name (not the difficulty word)", () => {
    const { container } = render(<ArenaSelectScaffold {...baseProps} />);
    const names = Array.from(
      container.querySelectorAll(".arena-scaffold-rival-name"),
    ).map((n) => n.textContent);
    expect(names).toEqual(["Pipo", "Mara", "Kairo"]);
  });

  it("renders the 'Choose your rival' section header", () => {
    render(<ArenaSelectScaffold {...baseProps} />);
    expect(screen.getByText(/Choose your rival/i)).toBeInTheDocument();
  });

  it("keeps the difficulty as a secondary badge on every card", () => {
    const { container } = render(<ArenaSelectScaffold {...baseProps} />);
    const badges = Array.from(
      container.querySelectorAll(".arena-scaffold-difficulty-badge"),
    ).map((n) => n.textContent);
    expect(badges).toEqual(["Easy", "Medium", "Hard"]);
  });

  it("never surfaces the word 'AI' in a rival tagline", () => {
    const { container } = render(<ArenaSelectScaffold {...baseProps} />);
    const taglines = Array.from(
      container.querySelectorAll(".arena-scaffold-difficulty-desc"),
    )
      .map((n) => n.textContent ?? "")
      .join(" ");
    expect(taglines).not.toMatch(/\bAI\b/);
  });
});
