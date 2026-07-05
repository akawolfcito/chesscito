import { describe, expect, it, vi } from "vitest";
import { renderWithIntl as render } from "@/test-utils/render-with-intl";
import { screen } from "@testing-library/react";
import { PlayHubScaffold } from "../play-hub-scaffold";

vi.mock("@/components/kingdom/kingdom-anchor", () => ({
  KingdomAnchor: () => <div data-testid="pro-portal" />,
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
vi.mock("@/components/hub/hub-action-tile", () => ({
  HubActionTile: ({ label, ariaLabel }: { label: string; ariaLabel: string }) => (
    <button aria-label={ariaLabel}>{label}</button>
  ),
}));
vi.mock("@/components/kingdom/primary-play-cta", () => ({
  PrimaryPlayCta: ({ label, ariaLabel }: { label: string; ariaLabel: string }) => (
    <button aria-label={ariaLabel}>{label}</button>
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
  it("renders the competitive surfaces and zero minted victories", () => {
    render(<PlayHubScaffold {...props} />);

    expect(screen.getByLabelText("Minted Arena victories: 0")).toHaveTextContent("0");
    expect(screen.getByTestId("pro-portal")).toBeInTheDocument();
    expect(screen.getByText("Coach")).toBeInTheDocument();
    expect(screen.getByText("Shop")).toBeInTheDocument();
    expect(screen.getByText("ENTER ARENA")).toBeInTheDocument();
  });

  it("places the Training | Play switch below the portal", () => {
    render(<PlayHubScaffold {...props} />);
    const portal = screen.getByTestId("pro-portal");
    const modeSwitch = screen.getByTestId("mode-switch");
    expect(portal.compareDocumentPosition(modeSwitch) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("has one primary Arena CTA and no Training or Tactics content", () => {
    render(<PlayHubScaffold {...props} />);

    expect(screen.getAllByRole("button", { name: "Enter Arena: full chess vs AI" })).toHaveLength(1);
    expect(screen.queryByText(/Training Path/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Train Pieces/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Daily Focus/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Special Training/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Tactic/i)).not.toBeInTheDocument();
  });
});
