import { describe, expect, it, vi } from "vitest";
import { renderWithIntl as render } from "@/test-utils/render-with-intl";
import { screen, within } from "@testing-library/react";
import { PlayHubScaffold } from "../play-hub-scaffold";
import { ThemeVariantOverride } from "@/lib/themes/theme-variant-provider";

vi.mock("@/components/kingdom/kingdom-card", () => ({
  KingdomCard: ({ pro }: { pro: { active: boolean } }) => (
    <div data-testid="kingdom-card" data-pro={pro.active} />
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
    <button className={className}>Tactics</button>
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
  }: {
    label: string;
    ariaLabel: string;
    className?: string;
    badge?: React.ReactNode;
  }) => (
    <button aria-label={ariaLabel} className={className}>
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
  it("renders the unified surfaces: LEARN mascot, Kingdom panel, Play Chess CTA", () => {
    render(<PlayHubScaffold {...props} />);

    expect(screen.getByLabelText("Minted victories: 0")).toHaveTextContent("0");
    // Title + avatar reuse the exact LEARN/LITE mascot markup.
    expect(screen.getByAltText("Chesscito")).toBeInTheDocument();
    expect(screen.getByTestId("kingdom-card")).toBeInTheDocument();
    expect(screen.getByText("PLAY CHESS")).toBeInTheDocument();
    expect(screen.getByTestId("play-daily")).toBeInTheDocument();
  });

  it("opts into the canonical LEARN home/header geometry", () => {
    const { container } = render(<PlayHubScaffold {...props} />);

    expect(screen.getByRole("main")).toHaveClass("hub-home-scaffold");
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

  it("orders mascot → switch → Kingdom panel → CTA → CHESS TOOLS", () => {
    render(<PlayHubScaffold {...props} />);
    const mascot = screen.getByAltText("Chesscito");
    const modeSwitch = screen.getByTestId("mode-switch");
    const panel = screen.getByTestId("kingdom-card");
    const tools = screen.getByText("CHESS TOOLS");
    expect(mascot.compareDocumentPosition(modeSwitch) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(modeSwitch.compareDocumentPosition(panel) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(panel.compareDocumentPosition(tools) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
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

  it("has one primary Play Chess CTA and no Learn/Training content", () => {
    const { container } = render(<PlayHubScaffold {...props} />);

    expect(
      screen.getAllByRole("button", { name: "Play Chess: full chess vs AI" }),
    ).toHaveLength(1);
    expect(
      container.querySelector(".hub-scaffold-cta-row > .play-chess-cta"),
    ).not.toBeNull();
    expect(screen.queryByText(/Training Path/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Daily Focus/i)).not.toBeInTheDocument();
  });

  it("renders CHESS TOOLS (Tactics/Coach/Shop) as square tiles, not pills", () => {
    render(<PlayHubScaffold {...props} />);

    expect(screen.getByText("CHESS TOOLS")).toBeInTheDocument();
    for (const label of ["Tactics", "Coach", "Shop"]) {
      expect(screen.getByText(label)).not.toHaveClass("candy-tray-pill");
    }
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
