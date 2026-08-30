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
  isWalletConnected: true,
  pro: { active: false } as const,
  // The scaffold is told the balance; it no longer fetches it. A wagmi hook in
  // this tree is what kept the PLAY hub out of every VR baseline.
  peones: { kind: "success", balance: 12, dailyEarnedCapped: 0, dailyCap: 10, lastEventAt: null } as const,
  dailySlot: <button data-testid="play-daily">Daily</button>,
  onPeonesRefetch: vi.fn(),
  onConnectTap: vi.fn(),
  onProTap: vi.fn(),
  onCoachTap: vi.fn(),
  onShopTap: vi.fn(),
  onArenaPress: vi.fn(),
};

describe("PlayHubScaffold", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the unified surfaces: LEARN mascot, DUEL and PLAY PATH", () => {
    render(<PlayHubScaffold {...props} />);

    /* ⛔ The trophy pill is gone: a `0` scoreboard was the first thing a
     *  newcomer read, and 434 of 443 wallets play a single day. */
    expect(screen.queryByLabelText(/Minted victories/)).not.toBeInTheDocument();

    // Title + avatar reuse the exact LEARN/LITE mascot markup.
    expect(screen.getByAltText("Chesscito")).toBeInTheDocument();
    expect(screen.getByTestId("play-chess-cta")).toBeInTheDocument();
    expect(screen.getByText("PLAY PATH")).toBeInTheDocument();
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

  it("orders mascot → switch → DUEL → PLAY PATH, with no panel between them", () => {
    render(<PlayHubScaffold {...props} />);
    const mascot = screen.getByAltText("Chesscito");
    const modeSwitch = screen.getByTestId("mode-switch");
    const cta = screen.getByTestId("play-chess-cta");
    const path = screen.getByText("PLAY PATH");
    expect(mascot.compareDocumentPosition(modeSwitch) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(modeSwitch.compareDocumentPosition(cta) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(cta.compareDocumentPosition(path) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    /* The panel is gone for good: it was onboarding copy made permanent, and
     *  the world render behind it is the `<KingdomAnchor>` it stood in for. */
    expect(screen.queryByTestId("kingdom-card")).not.toBeInTheDocument();
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

  /**
   * 2026-08-29 — this test used to assert the OPPOSITE: that the standalone
   * CTA was absent and the floor rail owned the Arena entry. That state was
   * introduced in `b7840ab4` (2026-07-26) with no measurement; the measured
   * consequence was that 39% of the 5.957 people reaching this hub never
   * started a match, including 35,4% of those who completed the whole tour.
   *
   * 2026-08-30 — the rail shortcut is now gone as well. Keeping both was a
   * deliberate intermediate step, and this test used to pin their accessible
   * names apart. The duplication itself is what got removed: same handler,
   * same art, 200 px apart. What survives is the rule the CTA was restored
   * for — there IS a dominant entry to a match, and there is exactly one.
   */
  it("gives the hub exactly one control that starts a match", async () => {
    const { container } = render(<PlayHubScaffold {...props} />);

    const cta = screen.getByTestId("play-chess-cta");
    expect(container.querySelector(".hub-scaffold-cta-row > .play-chess-cta")).not.toBeNull();
    expect(cta).toHaveAccessibleName("Duel: pick your rival and play a full match");

    // The whole screen holds one Arena entry, not two.
    expect(container.querySelectorAll('[data-icon-slot="hub.enter-arena"]')).toHaveLength(0);

    await userEvent.click(cta);
    expect(props.onArenaPress).toHaveBeenCalledTimes(1);

    expect(screen.queryByText(/Training Path/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Daily Focus/i)).not.toBeInTheDocument();
  });

  it("renders PLAY PATH in DOM order Coach → Shop", () => {
    render(<PlayHubScaffold {...props} />);

    expect(screen.getByText("PLAY PATH")).toBeInTheDocument();
    const path = screen.getByRole("region", { name: "PLAY PATH" });
    const actions = within(path).getAllByRole("button");
    expect(actions.map((button) => button.textContent)).toEqual([
      "Coach",
      "Shop",
    ]);
    for (const label of ["Coach", "Shop"]) {
      expect(screen.getByText(label)).not.toHaveClass("candy-tray-pill");
    }
  });

  it("marks only Play as the primary PLAY PATH action", () => {
    render(<PlayHubScaffold {...props} />);

    const path = screen.getByRole("region", { name: "PLAY PATH" });
    for (const action of within(path).getAllByRole("button")) {
      expect(action).not.toHaveClass("play-hub-path-tile--primary");
    }
  });

  /* ⛔ THE invariant of this revision. The rail used to lead with a `Duel` tile
   *  wired to the SAME `onArenaPress` as the CTA 200 px above it — two identical
   *  doors a thumb apart. If a rail tile ever starts a match again, the primary
   *  CTA stops being unambiguous and this whole layout loses its argument. */
  it("gives the floor rail no way to start a match", async () => {
    const onArenaPress = vi.fn();
    render(<PlayHubScaffold {...props} onArenaPress={onArenaPress} />);

    const path = screen.getByRole("region", { name: "PLAY PATH" });
    for (const tile of within(path).getAllByRole("button")) {
      await userEvent.click(tile);
    }

    expect(onArenaPress).not.toHaveBeenCalled();
  });

  /* ⛔ The rail holds only what earned a slot. PRO and Trophies were briefly
   *  added to fill a 4-column CSS grid and removed the same day: a hole in a
   *  layout is not a product requirement. */
  it("keeps the rail to the two destinations that earned a slot", () => {
    render(<PlayHubScaffold {...props} />);

    const path = screen.getByRole("region", { name: "PLAY PATH" });
    expect(
      within(path)
        .getAllByRole("button")
        .map((button) => button.textContent),
    ).toEqual(["Coach", "Shop"]);
    for (const gone of ["Warm-up", "Duel", "Trophies"]) {
      expect(within(path).queryByText(gone)).not.toBeInTheDocument();
    }
  });

  /* ⛔ PRO is STATUS here, never an offer. A player who cannot buy it — which
   *  is 59,6% of the people who reach the PRO sheet, and everyone at all while
   *  the sale is paused — must never meet it on this screen. */
  it("shows no PRO tile to a player without an active subscription", () => {
    render(<PlayHubScaffold {...props} />);

    const path = screen.getByRole("region", { name: "PLAY PATH" });
    expect(within(path).queryByText("PRO")).not.toBeInTheDocument();
  });

  it("shows PRO to an active subscriber, as days remaining and not a price", async () => {
    render(
      <PlayHubScaffold {...props} pro={{ active: true, daysRemaining: 12 }} />,
    );

    const path = screen.getByRole("region", { name: "PLAY PATH" });
    const tile = within(path).getByRole("button", { name: /PRO/ });
    expect(tile).toHaveTextContent("12d");
    expect(tile).not.toHaveTextContent("$");

    await userEvent.click(tile);
    expect(props.onProTap).toHaveBeenCalledTimes(1);
  });

  it("still exposes the Daily target, which outlived the tour", () => {
    const { container } = render(<PlayHubScaffold {...props} />);
    expect(container.querySelector('[data-tour-target="daily"]')).not.toBeNull();
  });

  /* The panel is gone, so nothing on this screen replays a tour — and nothing
   *  should offer to. */
  it("offers no tour replay control", () => {
    render(<PlayHubScaffold {...props} />);
    expect(screen.queryByText("Replay Play Hub tour")).not.toBeInTheDocument();
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
