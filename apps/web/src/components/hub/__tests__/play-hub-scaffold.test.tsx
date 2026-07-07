import { describe, expect, it, vi } from "vitest";
import { renderWithIntl as render } from "@/test-utils/render-with-intl";
import { screen } from "@testing-library/react";
import { PlayHubScaffold } from "../play-hub-scaffold";

vi.mock("@/components/kingdom/kingdom-anchor", () => ({
  KingdomAnchor: () => <div data-testid="pro-portal" />,
}));
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
vi.mock("@/components/hub/hub-pro-badge", () => ({
  HubProBadge: ({ ariaLabel }: { ariaLabel: string }) => <button aria-label={ariaLabel}>PRO</button>,
}));
vi.mock("@/components/tactics/play-tactics-tile", () => ({
  PlayTacticsTile: ({ className }: { className?: string }) => (
    <button className={className}>Tactics</button>
  ),
}));
vi.mock("@/components/hub/hub-action-tile", () => ({
  HubActionTile: ({ label, ariaLabel, className }: { label: string; ariaLabel: string; className?: string }) => (
    <button aria-label={ariaLabel} className={className}>{label}</button>
  ),
}));
vi.mock("@/components/kingdom/primary-play-cta", () => ({
  PrimaryPlayCta: ({ label, ariaLabel, className }: { label: string; ariaLabel: string; className?: string }) => (
    <button aria-label={ariaLabel} className={className}>{label}</button>
  ),
}));

const props = {
  mintedVictoryCount: 0,
  isWalletConnected: true,
  pro: { active: false } as const,
  onConnectTap: vi.fn(),
  onTrophyTap: vi.fn(),
  onProTap: vi.fn(),
  onCoachTap: vi.fn(),
  onShopTap: vi.fn(),
  onArenaPress: vi.fn(),
};

describe("PlayHubScaffold", () => {
  it("renders the unified surfaces: portal, Kingdom panel, Play Chess CTA", () => {
    render(<PlayHubScaffold {...props} />);

    expect(screen.getByLabelText("Minted victories: 0")).toHaveTextContent("0");
    expect(screen.getByTestId("pro-portal")).toBeInTheDocument();
    expect(screen.getByTestId("kingdom-card")).toBeInTheDocument();
    expect(screen.getByText("PLAY CHESS")).toBeInTheDocument();
  });

  it("orders portal → switch → Kingdom panel → CTA → CHESS TOOLS", () => {
    render(<PlayHubScaffold {...props} />);
    const portal = screen.getByTestId("pro-portal");
    const modeSwitch = screen.getByTestId("mode-switch");
    const panel = screen.getByTestId("kingdom-card");
    const tools = screen.getByText("CHESS TOOLS");
    expect(portal.compareDocumentPosition(modeSwitch) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(modeSwitch.compareDocumentPosition(panel) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(panel.compareDocumentPosition(tools) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("has one primary Play Chess CTA and no Learn/Training content", () => {
    const { container } = render(<PlayHubScaffold {...props} />);

    expect(
      screen.getAllByRole("button", { name: "Play Chess: full chess vs AI" }),
    ).toHaveLength(1);
    expect(
      container.querySelector(".hub-scaffold-cta-row > .hub-scaffold-arena-cta"),
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
});
