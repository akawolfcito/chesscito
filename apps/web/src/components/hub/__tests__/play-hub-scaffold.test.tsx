import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithIntl as render } from "@/test-utils/render-with-intl";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PlayHubScaffold } from "../play-hub-scaffold";
import { ThemeVariantOverride } from "@/lib/themes/theme-variant-provider";

vi.mock("@/components/kingdom/kingdom-card", () => ({
  KingdomCard: ({
    pro,
    onReplayTour,
  }: {
    pro: { active: boolean };
    onReplayTour?: () => void;
  }) => (
    <div data-testid="kingdom-card" data-pro={pro.active}>
      {onReplayTour ? <button onClick={onReplayTour}>Replay Play Hub tour</button> : null}
    </div>
  ),
}));
vi.mock("@/components/hub/app-mode-switch", () => ({
  AppModeSwitch: ({ activeMode }: { activeMode: string }) => (
    <div data-testid="mode-switch">Training | {activeMode}</div>
  ),
}));
vi.mock("@/components/hub/language-chip", () => ({ LanguageChip: () => null }));
vi.mock("@/components/peones/peones-balance-chip", () => ({
  PeonesBalanceChipView: () => <div data-testid="peones-chip" />,
}));
vi.mock("@/components/tactics/play-tactics-tile", () => ({
  PlayTacticsTile: ({ className }: { className?: string }) => (
    <button className={className} aria-label="Open Arena warm-up">Warm-up</button>
  ),
}));
// The mock MUST render `badge` — otherwise a test asserting the Coach tile
// carries no PRO badge would pass while the real tile still wears one.
vi.mock("@/components/hub/hub-action-tile", () => ({
  HubActionTile: ({
    label,
    ariaLabel,
    className,
    badge,
    iconSlot,
    onClick,
    tourTarget,
  }: {
    label: string;
    ariaLabel: string;
    className?: string;
    badge?: React.ReactNode;
    iconSlot?: string;
    onClick?: () => void;
    tourTarget?: string;
  }) => (
    <button
      aria-label={ariaLabel}
      className={className}
      data-icon-slot={iconSlot}
      onClick={onClick}
      data-tour-target={tourTarget}
    >
      {label}
      {badge}
    </button>
  ),
}));
const props = {
  mintedVictoryCount: 0,
  isWalletConnected: true,
  pro: { active: false } as const,
  // The scaffold is told the balance; it no longer fetches it. A wagmi hook in
  // this tree is what kept the PLAY hub out of every VR baseline.
  peones: { kind: "success", balance: 12, dailyEarnedCapped: 0, dailyCap: 10, lastEventAt: null } as const,
  dailySlot: <button data-testid="play-daily">Daily</button>,
  onPeonesRefetch: vi.fn(),
  onConnectTap: vi.fn(),
  onTrophyTap: vi.fn(),
  onProTap: vi.fn(),
  onCoachTap: vi.fn(),
  onShopTap: vi.fn(),
  onArenaPress: vi.fn(),
};

describe("PlayHubScaffold", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the unified surfaces: LEARN mascot, Kingdom panel and PLAY PATH", () => {
    render(<PlayHubScaffold {...props} />);

    expect(screen.getByLabelText("Minted victories: 0")).toHaveTextContent("0");
    // Title + avatar reuse the exact LEARN/LITE mascot markup.
    expect(screen.getByAltText("Chesscito")).toBeInTheDocument();
    expect(screen.getByTestId("kingdom-card")).toBeInTheDocument();
    expect(screen.getByText("PLAY PATH")).toBeInTheDocument();
    expect(screen.getByText("Play")).toBeInTheDocument();
    expect(screen.getByTestId("play-daily")).toBeInTheDocument();
  });

  it("opts into the canonical LEARN home/header geometry", () => {
    const { container } = render(<PlayHubScaffold {...props} />);

        // ⚠️ `region`, no `main`: el landmark `<main>` del documento es el del
    // layout. Estos scaffolds pasaron a `<section aria-label>` para que haya UN
    // solo `<main>` por documento, conservando su nombre accesible.
    // El nombre es obligatorio: el documento tiene más de una `region`.
    expect(
      screen.getByRole("region", { name: "Chesscito Play Hub" }),
    ).toHaveClass("hub-home-scaffold");
    expect(container.querySelector(".hub-scaffold-hud-top")).toHaveClass(
      "hub-home-hud",
    );
    expect(container.querySelector(".hub-scaffold-hud-left")).toHaveClass(
      "hub-home-hud-left",
    );
    expect(container.querySelector(".hub-scaffold-hud-right")).toHaveClass(
      "hub-home-hud-right",
    );
  });

  it("orders mascot → switch → Kingdom panel → PLAY PATH", () => {
    render(<PlayHubScaffold {...props} />);
    const mascot = screen.getByAltText("Chesscito");
    const modeSwitch = screen.getByTestId("mode-switch");
    const panel = screen.getByTestId("kingdom-card");
    const path = screen.getByText("PLAY PATH");
    expect(mascot.compareDocumentPosition(modeSwitch) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(modeSwitch.compareDocumentPosition(panel) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(panel.compareDocumentPosition(path) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("renders the Peones chip when connected but NO account chip (hidden in PLAY)", () => {
    render(<PlayHubScaffold {...props} />);
    expect(screen.getByTestId("peones-chip")).toBeInTheDocument();
    expect(screen.queryByTestId("play-hub-account-chip")).toBeNull();
  });

  it("hides the Peones chip for guests", () => {
    render(<PlayHubScaffold {...props} isWalletConnected={false} />);
    expect(screen.queryByTestId("peones-chip")).toBeNull();
  });

  it("swaps to the PRO avatar when pro is active", () => {
    render(
      <ThemeVariantOverride variant="pro">
        <PlayHubScaffold {...props} pro={{ active: true, daysRemaining: 200 }} />
      </ThemeVariantOverride>,
    );
    expect(screen.getByAltText("Chesscito")).toBeInTheDocument();
    const avatar = document.querySelector(".hub-lite-avatar img") as HTMLImageElement;
    expect(avatar.getAttribute("src")).toContain("avatar-pro");
  });

  it("hides the standalone Play Chess CTA but keeps Arena first in PLAY PATH", async () => {
    const { container } = render(<PlayHubScaffold {...props} />);

    expect(
      screen.getAllByRole("button", { name: "Play Chess: full chess vs AI" }),
    ).toHaveLength(1);
    expect(
      container.querySelector(".hub-scaffold-cta-row > .play-chess-cta"),
    ).toBeNull();
    expect(screen.queryByTestId("play-chess-cta")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Play Chess: full chess vs AI" }),
    ).toHaveAttribute("data-icon-slot", "hub.enter-arena");

    await userEvent.click(
      screen.getByRole("button", { name: "Play Chess: full chess vs AI" }),
    );
    expect(props.onArenaPress).toHaveBeenCalledTimes(1);

    expect(screen.queryByText(/Training Path/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Daily Focus/i)).not.toBeInTheDocument();
  });

  it("renders PLAY PATH in DOM order Play → Warm-up → Coach → Shop", () => {
    render(<PlayHubScaffold {...props} />);

    expect(screen.getByText("PLAY PATH")).toBeInTheDocument();
    const path = screen.getByRole("region", { name: "PLAY PATH" });
    const actions = within(path).getAllByRole("button");
    expect(actions.map((button) => button.textContent)).toEqual([
      "Play",
      "Warm-up",
      "Coach",
      "Shop",
    ]);
    for (const label of ["Play", "Warm-up", "Coach", "Shop"]) {
      expect(screen.getByText(label)).not.toHaveClass("candy-tray-pill");
    }
  });

  it("marks only Play as the primary PLAY PATH action", () => {
    render(<PlayHubScaffold {...props} />);

    const path = screen.getByRole("region", { name: "PLAY PATH" });
    const [play, ...secondaryActions] = within(path).getAllByRole("button");
    expect(play).toHaveClass("play-hub-path-tile--primary");
    expect(play).toHaveAttribute("data-tour-target", "play");
    for (const action of secondaryActions) {
      expect(action).not.toHaveClass("play-hub-path-tile--primary");
    }
  });

  it("exposes stable Daily and replay targets for the PLAY mini-tour", async () => {
    const onReplayTour = vi.fn();
    const { container } = render(
      <PlayHubScaffold {...props} onReplayTour={onReplayTour} />,
    );
    expect(container.querySelector('[data-tour-target="daily"]')).not.toBeNull();
    await userEvent.click(screen.getByText("Replay Play Hub tour"));
    expect(onReplayTour).toHaveBeenCalledTimes(1);
  });

  // The tile no longer guards a paywall, so it must not wear one. A badge that
  // announces a wall where none exists is a lie the player pays for by never
  // opening the door.
  it("does not brand the Coach tile as PRO-locked", () => {
    render(<PlayHubScaffold {...props} />);

    const coachTile = screen.getByText("Coach").closest("button") as HTMLElement;
    expect(within(coachTile).queryByText("PRO")).not.toBeInTheDocument();
  });
});
