import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent } from "@testing-library/react";
import { renderWithIntl as render, screen } from "@/test-utils/render-with-intl";

import { HubLiteScaffold, type HubLiteScaffoldProps } from "../hub-lite-scaffold";
import type { RewardTile } from "@/components/kingdom/reward-column";
import type { ContentLoopAction, ContentLoopVariant } from "@/lib/hub/content-loop";

// Heavy leaves (wagmi / theme / routing) are exercised in their own suites;
// stub them so this test stays a pure composition assertion.
vi.mock("@/components/hub/hub-daily-tile", () => ({
  HubDailyTile: ({ variant }: { variant?: string }) => (
    <div data-testid="daily-tile-stub" data-variant={variant} />
  ),
}));
vi.mock("@/components/kingdom/kingdom-anchor", () => ({
  KingdomAnchor: () => <div data-testid="kingdom-anchor-stub" />,
}));
vi.mock("@/components/hub/language-chip", () => ({
  LanguageChip: () => <div data-testid="language-chip-stub" />,
}));

const TILES: RewardTile[] = [
  { id: "rook", state: "claimed" },
  { id: "bishop", state: "progress" },
  { id: "knight", state: "locked" },
  { id: "pawn", state: "locked" },
  { id: "queen", state: "locked" },
  { id: "king", state: "locked" },
];

function action(variant: ContentLoopVariant): ContentLoopAction {
  return {
    variant,
    destination: "/exercises",
    ctaEN: "EN cta",
    ctaES: "ES cta",
    subEN: "EN sub",
    subES: "ES sub",
  };
}

function baseProps(over: Partial<HubLiteScaffoldProps> = {}): HubLiteScaffoldProps {
  return {
    trophies: 1,
    isWalletConnected: false,
    onConnectTap: vi.fn(),
    onTrophyTap: vi.fn(),
    focusPassport: { streak: 3, totalCompleted: 3, todayDone: true, isLoading: false },
    challenge: { durationDays: 21, shieldBonus: 3, priceLabel: "$1.99" },
    seasonPass: { active: false, isLoading: false },
    onJoinChallenge: vi.fn(),
    primaryFocus: { onPress: vi.fn(), contentLoop: action("daily-pending"), isHydrated: true },
    rewardTiles: TILES,
    ...over,
  };
}

afterEach(() => {
  cleanup();
});

describe("<HubLiteScaffold>", () => {
  it("HUD: trophy chip (count + tap), language chip, daily corner-icon, guest Connect", () => {
    const onTrophyTap = vi.fn();
    const onConnectTap = vi.fn();
    render(<HubLiteScaffold {...baseProps({ onTrophyTap, onConnectTap })} />);

    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByTestId("language-chip-stub")).toBeInTheDocument();
    expect(screen.getByTestId("daily-tile-stub")).toHaveAttribute("data-variant", "corner-icon");

    const connect = screen.getByRole("button", { name: /connect/i });
    fireEvent.click(connect);
    expect(onConnectTap).toHaveBeenCalledTimes(1);
  });

  it("connected: no Connect chip", () => {
    render(<HubLiteScaffold {...baseProps({ isWalletConnected: true, onConnectTap: null })} />);
    expect(screen.queryByRole("button", { name: /connect/i })).toBeNull();
  });

  it("offer state: ChallengeCard shows the Join CTA", () => {
    const onJoin = vi.fn();
    render(<HubLiteScaffold {...baseProps({ onJoinChallenge: onJoin })} />);
    fireEvent.click(screen.getByTestId("challenge-join-cta"));
    expect(onJoin).toHaveBeenCalledTimes(1);
  });

  it("Start Focus: label intent per variant, routes on press", () => {
    const onPress = vi.fn();
    render(
      <HubLiteScaffold
        {...baseProps({
          primaryFocus: { onPress, contentLoop: action("daily-limit-reached"), isHydrated: true },
        })}
      />,
    );
    const cta = screen.getByTestId("start-focus-cta");
    expect(cta.textContent).toMatch(/Practice/i);
    fireEvent.click(cta);
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("Start Focus: pre-hydration (null content loop) → safe default label", () => {
    render(
      <HubLiteScaffold
        {...baseProps({ primaryFocus: { onPress: vi.fn(), contentLoop: null, isHydrated: false } })}
      />,
    );
    expect(screen.getByTestId("start-focus-cta").textContent).toMatch(/Start Focus/i);
  });

  it("Training Path: renders all 6 piece tiles", () => {
    render(<HubLiteScaffold {...baseProps()} />);
    const path = screen.getByRole("region", { name: /training path/i });
    expect(path.querySelectorAll(".reward-tile")).toHaveLength(6);
  });

  it("P1-A: Start Focus and Join CTA precede the Training Path in DOM order", () => {
    const { container } = render(<HubLiteScaffold {...baseProps()} />);
    const order = (sel: string) =>
      Array.prototype.indexOf.call(container.querySelectorAll("*"), container.querySelector(sel));
    const startFocus = order('[data-testid="start-focus-cta"]');
    const join = order('[data-testid="challenge-join-cta"]');
    const path = order(".hub-lite-training-path");
    expect(startFocus).toBeLessThan(path);
    expect(join).toBeLessThan(path);
  });

  it("ES locale: Start Focus label is translated (i18n parity)", () => {
    render(<HubLiteScaffold {...baseProps()} />, { locale: "es" });
    expect(screen.getByTestId("start-focus-cta").textContent).toMatch(/Comenzar foco/i);
  });
});
