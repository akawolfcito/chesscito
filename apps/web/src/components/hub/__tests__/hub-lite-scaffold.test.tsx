import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithIntl as render, screen } from "@/test-utils/render-with-intl";

import { HubLiteScaffold, type HubLiteScaffoldProps } from "../hub-lite-scaffold";
import type { RewardTile } from "@/components/kingdom/reward-column";
import type { ContentLoopAction, ContentLoopVariant } from "@/lib/hub/content-loop";
import { ThemeVariantOverride } from "@/lib/themes/theme-variant-provider";

// Heavy leaves (wagmi / theme / routing) are exercised in their own suites;
// stub them so this test stays a pure composition assertion.
//
// `hub-daily-tile` is NOT mocked here anymore, and that is the point of the
// slot: the scaffold no longer imports it. The tile calls `useAccount()`, so
// while the scaffold mounted it directly, every consumer without a wagmi
// provider — this suite, a `/dev` probe — had to stub the module to render at
// all. Now the daily arrives as a `ReactNode` the container builds.
vi.mock("@/components/hub/language-chip", () => ({
  LanguageChip: () => <div data-testid="language-chip-stub" />,
}));
vi.mock("@/components/peones/peones-balance-chip", () => ({
  PeonesBalanceChipView: ({ surface }: { surface?: string }) => (
    <div data-testid="peones-chip-stub" data-surface={surface} />
  ),
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
    // Told, not fetched — the container owns the wallet read now.
    peones: { kind: "guest" },
    onPeonesRefetch: vi.fn(),
    onConnectTap: vi.fn(),
    onTrophyTap: vi.fn(),
    focusPassport: { streak: 3, totalCompleted: 3, todayDone: true, isLoading: false },
    challenge: { challengeGoalDays: 21, accessDurationDays: 30, shieldBonus: 3, priceLabel: "$1.99" },
    seasonPass: { active: false, isLoading: false },
    progress: { state: "offer" },
    onJoinChallenge: vi.fn(),
    primaryFocus: { onPress: vi.fn(), contentLoop: action("daily-pending"), isHydrated: true },
    rewardTiles: TILES,
    isPro: false,
    onAccountTap: vi.fn(),
    dailySlot: <button type="button" data-testid="daily-slot-stub" />,
    onPassportTap: vi.fn(),
    ...over,
  };
}

afterEach(() => {
  cleanup();
});

describe("<HubLiteScaffold>", () => {
  it("exposes Learn branding without changing the training composition", () => {
    render(<HubLiteScaffold {...baseProps()} />);

    expect(screen.getByRole("main", { name: "Chesscito Learn home" })).toBeInTheDocument();
    expect(screen.getByText("21-Day Mind Challenge")).toBeInTheDocument();
    expect(screen.getByTestId("challenge-cta")).toBeInTheDocument();
  });

  it("owns the canonical shared home/header geometry", () => {
    const { container } = render(<HubLiteScaffold {...baseProps()} />);

    expect(screen.getByRole("main")).toHaveClass("hub-home-scaffold");
    expect(container.querySelector(".hub-lite-hud")).toHaveClass("hub-home-hud");
    expect(container.querySelector(".hub-lite-hud-left")).toHaveClass(
      "hub-home-hud-left",
    );
    expect(container.querySelector(".hub-lite-hud-right")).toHaveClass(
      "hub-home-hud-right",
    );
  });

  it("responsive Lite image derivatives exist in public art", () => {
    const paths = [
      "art/avatar-lite-hub-224w.avif",
      "art/avatar-lite-hub-340w.avif",
      "art/avatar-lite-hub-224w.webp",
      "art/avatar-lite-hub-340w.webp",
      "art/avatar-pro.png",
      "art/avatar-pro.webp",
      "art/avatar-pro.avif",
      "art/avatar-pro-224w.avif",
      "art/avatar-pro-340w.avif",
      "art/avatar-pro-224w.webp",
      "art/avatar-pro-340w.webp",
      "art/title-chesscito-288w.avif",
      "art/title-chesscito-384w.avif",
      "art/title-chesscito-288w.webp",
      "art/title-chesscito-384w.webp",
      "art/shop/welcome-gift-96w.avif",
      "art/shop/welcome-gift-128w.avif",
      "art/shop/welcome-gift-160w.avif",
      "art/shop/welcome-gift-96w.webp",
      "art/shop/welcome-gift-128w.webp",
      "art/shop/welcome-gift-160w.webp",
    ];

    for (const path of paths) {
      expect(existsSync(resolve(process.cwd(), "public", path)), path).toBe(true);
    }
  });

  it("HUD: trophy chip (count + tap), language chip, daily corner-icon, guest Connect", () => {
    const onTrophyTap = vi.fn();
    const onConnectTap = vi.fn();
    render(<HubLiteScaffold {...baseProps({ onTrophyTap, onConnectTap })} />);

    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByTestId("language-chip-stub")).toBeInTheDocument();
    // The daily is whatever the container handed over, mounted inside the
    // anchor the Hub Tour measures its spotlight against.
    const anchor = document.querySelector(".hub-lite-daily-anchor");
    expect(anchor).toHaveAttribute("data-tour-target", "daily");
    expect(anchor).toContainElement(screen.getByTestId("daily-slot-stub"));

    const connect = screen.getByRole("button", { name: /connect/i });
    fireEvent.click(connect);
    expect(onConnectTap).toHaveBeenCalledTimes(1);
  });

  it("connected: no Connect chip", () => {
    render(<HubLiteScaffold {...baseProps({ isWalletConnected: true, onConnectTap: null })} />);
    expect(screen.queryByRole("button", { name: /connect/i })).toBeNull();
  });

  it("connected: shows the Peones chip (hub surface); Account chip is hidden on the Learn hub", () => {
    render(
      <HubLiteScaffold
        {...baseProps({ isWalletConnected: true, onConnectTap: null })}
      />,
    );
    expect(screen.getByTestId("peones-chip-stub")).toHaveAttribute("data-surface", "hub");
    // Account access lives on /exercises — the circular avatar chip is
    // intentionally not rendered in the Learn hub header.
    expect(screen.queryByTestId("hub-account-chip")).toBeNull();
  });

  it("guest: no Peones chip and no Account chip", () => {
    render(<HubLiteScaffold {...baseProps()} />);
    expect(screen.queryByTestId("peones-chip-stub")).toBeNull();
    expect(screen.queryByTestId("hub-account-chip")).toBeNull();
  });

  it("PRO connected: Account chip stays hidden (no header avatar)", () => {
    render(
      <HubLiteScaffold
        {...baseProps({
          isWalletConnected: true,
          onConnectTap: null,
          isPro: true,
        })}
      />,
    );
    expect(screen.queryByTestId("hub-account-chip")).toBeNull();
  });

  it("offer state: ChallengeCard shows the Join CTA", () => {
    const onJoin = vi.fn();
    render(<HubLiteScaffold {...baseProps({ onJoinChallenge: onJoin })} />);
    const cta = screen.getByTestId("challenge-cta");
    expect(cta).toHaveAttribute("data-cta-state", "join");
    fireEvent.click(cta);
    expect(onJoin).toHaveBeenCalledTimes(1);
  });

  // The standalone Start Focus button is HIDDEN (2026-07-25). Its job moved to
  // the ChallengeCard's single state-driven CTA — these tests guard that the
  // hand-off is complete and that nothing else lost its entry point.
  it("no longer renders a standalone Start Focus button or its ring art", () => {
    const { container } = render(<HubLiteScaffold {...baseProps()} />);
    expect(screen.queryByTestId("start-focus-cta")).toBeNull();
    expect(container.querySelector(".hub-lite-start-focus-wrap")).toBeNull();
    expect(container.querySelector(".hub-lite-start-focus-ring")).toBeNull();
  });

  it("renders exactly one primary CTA on the hub", () => {
    render(<HubLiteScaffold {...baseProps()} />);
    expect(screen.getAllByTestId("challenge-cta")).toHaveLength(1);
  });

  it("exposes the Rook as the final LEARN tour target", () => {
    render(<HubLiteScaffold {...baseProps()} />);
    expect(screen.getByText("Rook").closest("button")).toHaveAttribute(
      "data-tour-target",
      "rook",
    );
  });

  it("routes into today's focus from the card CTA when the pass is active", () => {
    const onPress = vi.fn();
    render(
      <HubLiteScaffold
        {...baseProps({
          seasonPass: {
            active: true,
            source: "season_pass",
            shieldsCredited: 3,
          },
          onJoinChallenge: null,
          focusPassport: {
            streak: 2,
            totalCompleted: 2,
            todayDone: false,
            isLoading: false,
          },
          primaryFocus: { onPress, contentLoop: action("daily-limit-reached"), isHydrated: true },
        })}
      />,
    );
    const cta = screen.getByTestId("challenge-cta");
    expect(cta).toHaveAttribute("data-cta-state", "start");
    fireEvent.click(cta);
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("routes the Focus Passport tap to onPassportTap without invoking Exercises", () => {
    // That the tap opens the SAME mounted Daily (rather than a second
    // instance) is a composition fact now, asserted in the container's suite —
    // the scaffold only knows it must not confuse it with the training CTA.
    const onPress = vi.fn();
    const onPassportTap = vi.fn();
    render(
      <HubLiteScaffold
        {...baseProps({
          focusPassport: {
            streak: 2,
            totalCompleted: 2,
            todayDone: false,
            isLoading: false,
          },
          primaryFocus: {
            onPress,
            contentLoop: action("daily-pending"),
            isHydrated: true,
          },
          onPassportTap,
        })}
      />,
    );

    fireEvent.click(screen.getByTestId("challenge-progress"));
    expect(onPassportTap).toHaveBeenCalledTimes(1);
    expect(onPress).not.toHaveBeenCalled();
  });

  it("pulses the daily anchor only while today's daily is actually pending", () => {
    // The pulse is a cue, not decoration: it must not run before the passport
    // resolves (we don't know yet) nor after it is solved (that is a nag).
    const anchor = () => document.querySelector(".hub-lite-daily-anchor");

    const pending = render(
      <HubLiteScaffold
        {...baseProps({
          focusPassport: { streak: 2, totalCompleted: 2, todayDone: false, isLoading: false },
        })}
      />,
    );
    expect(anchor()).toHaveClass("is-pending");
    pending.unmount();

    const loading = render(
      <HubLiteScaffold
        {...baseProps({
          focusPassport: { streak: 0, totalCompleted: 0, todayDone: false, isLoading: true },
        })}
      />,
    );
    expect(anchor()).not.toHaveClass("is-pending");
    loading.unmount();

    render(
      <HubLiteScaffold
        {...baseProps({
          focusPassport: { streak: 3, totalCompleted: 3, todayDone: true, isLoading: false },
        })}
      />,
    );
    expect(anchor()).not.toHaveClass("is-pending");
  });

  it("card CTA: Enter and Space activate the same native button action", async () => {
    const user = userEvent.setup();
    const onPress = vi.fn();
    render(
      <HubLiteScaffold
        {...baseProps({
          seasonPass: { active: true, source: "pro" },
          onJoinChallenge: null,
          focusPassport: {
            streak: 1,
            totalCompleted: 1,
            todayDone: false,
            isLoading: false,
          },
          primaryFocus: { onPress, contentLoop: action("view-progress"), isHydrated: true },
        })}
      />,
    );
    const cta = screen.getByTestId("challenge-cta");

    cta.focus();
    await user.keyboard("{Enter}");
    await user.keyboard(" ");

    expect(onPress).toHaveBeenCalledTimes(2);
  });

  it("a completed daily informs without disabling the piece shortcuts", () => {
    // COME BACK TOMORROW is a status, not a gate: the Training Path stays
    // fully interactive so the player can keep training and improving scores.
    render(
      <HubLiteScaffold
        {...baseProps({
          seasonPass: {
            active: true,
            source: "season_pass",
            shieldsCredited: 3,
          },
          onJoinChallenge: null,
          focusPassport: {
            streak: 3,
            totalCompleted: 3,
            todayDone: true,
            isLoading: false,
          },
        })}
      />,
    );
    expect(screen.getByTestId("challenge-cta")).toHaveAttribute(
      "data-cta-state",
      "tomorrow",
    );

    const path = screen.getByRole("region", { name: /training path/i });
    const tiles = path.querySelectorAll(".reward-tile");
    expect(tiles).toHaveLength(6);
    for (const tile of tiles) {
      expect(tile.querySelector("[disabled]")).toBeNull();
      expect(tile.getAttribute("aria-disabled")).not.toBe("true");
    }
  });

  it("Mascot: exposes responsive AVIF/WebP candidates with intrinsic fallbacks", () => {
    const { container } = render(<HubLiteScaffold {...baseProps()} />);
    const title = container.querySelector(".hub-lite-title");
    const avatar = container.querySelector(".hub-lite-avatar");

    expect(title?.querySelector('source[type="image/avif"]')).toHaveAttribute(
      "srcset",
      "/art/title-chesscito-288w.avif 288w, /art/title-chesscito-384w.avif 384w, /art/title-chesscito.avif 512w",
    );
    expect(title?.querySelector('source[type="image/webp"]')).toHaveAttribute(
      "srcset",
      "/art/title-chesscito-288w.webp 288w, /art/title-chesscito-384w.webp 384w, /art/title-chesscito.webp 512w",
    );
    expect(title?.querySelector("source")).toHaveAttribute(
      "sizes",
      "(max-width: 352px) 141px, (max-width: 417px) 40vw, 167px",
    );
    expect(title?.querySelector("img")).toHaveAttribute("width", "512");
    expect(title?.querySelector("img")).toHaveAttribute("height", "249");

    expect(avatar?.querySelector('source[type="image/avif"]')).toHaveAttribute(
      "srcset",
      "/art/avatar-lite-hub-224w.avif 224w, /art/avatar-lite-hub-340w.avif 340w, /art/avatar-lite-hub.avif 499w",
    );
    expect(avatar?.querySelector('source[type="image/webp"]')).toHaveAttribute(
      "srcset",
      "/art/avatar-lite-hub-224w.webp 224w, /art/avatar-lite-hub-340w.webp 340w, /art/avatar-lite-hub.webp 499w",
    );
    expect(avatar?.querySelector("source")).toHaveAttribute(
      "sizes",
      "(max-width: 337px) 101px, (max-width: 377px) 30vw, 113px",
    );
    expect(avatar?.querySelector("img")).toHaveAttribute("width", "499");
    expect(avatar?.querySelector("img")).toHaveAttribute("height", "560");
  });

  it("Mascot (PRO): swaps to the avatar-pro derivatives", () => {
    const { container } = render(
      <ThemeVariantOverride variant="pro">
        <HubLiteScaffold {...baseProps({ isPro: true })} />
      </ThemeVariantOverride>,
    );
    const avatar = container.querySelector(".hub-lite-avatar");

    expect(avatar?.querySelector('source[type="image/avif"]')).toHaveAttribute(
      "srcset",
      "/art/avatar-pro-224w.avif 224w, /art/avatar-pro-340w.avif 340w, /art/avatar-pro.avif 499w",
    );
    expect(avatar?.querySelector('source[type="image/webp"]')).toHaveAttribute(
      "srcset",
      "/art/avatar-pro-224w.webp 224w, /art/avatar-pro-340w.webp 340w, /art/avatar-pro.webp 499w",
    );
    expect(avatar?.querySelector("img")).toHaveAttribute("src", "/art/avatar-pro.png");
    expect(avatar?.querySelector("img")).toHaveAttribute("width", "499");
    // Same intrinsic box as the default avatar → PRO swap is layout-shift-free.
    expect(avatar?.querySelector("img")).toHaveAttribute("height", "560");
  });

  it("renders the Training/Play switch below the avatar with Training selected", () => {
    const { container } = render(<HubLiteScaffold {...baseProps()} />);
    const mascot = container.querySelector(".hub-lite-mascot");
    const toggle = screen.getByRole("group", { name: "Choose app mode" });

    expect(mascot?.querySelector(".hub-lite-avatar + .hub-app-mode-switch")).toBe(toggle);
    expect(screen.getByRole("button", { name: "Switch to Training" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(toggle.querySelectorAll('source[type="image/avif"]')).toHaveLength(2);
    expect(toggle.querySelectorAll('source[type="image/webp"]')).toHaveLength(2);
  });

  it("Training Path: renders all 6 piece tiles", () => {
    render(<HubLiteScaffold {...baseProps()} />);
    const path = screen.getByRole("region", { name: /training path/i });
    expect(path.querySelectorAll(".reward-tile")).toHaveLength(6);
  });

  it("P1-A: the primary CTA precedes the Training Path in DOM order", () => {
    const { container } = render(<HubLiteScaffold {...baseProps()} />);
    const order = (sel: string) =>
      Array.prototype.indexOf.call(container.querySelectorAll("*"), container.querySelector(sel));
    const cta = order('[data-testid="challenge-cta"]');
    const path = order(".hub-lite-training-path");
    expect(cta).toBeLessThan(path);
  });

  it("ES locale: the CTA and the weekly row are translated (i18n parity)", () => {
    render(<HubLiteScaffold {...baseProps()} />, { locale: "es" });
    const cta = screen.getByTestId("challenge-cta");
    // The offer CTA is the Season Pass banner, so what it SHOWS is the pass;
    // the verb it used to display now lives in the accessible name. Both are
    // asserted, because both are translated strings and either could regress
    // to English (or to a raw key path) on its own.
    expect(cta.textContent).toMatch(/Season Pass de 21 días/i);
    expect(cta).toHaveAccessibleName(/Únete al Reto Mental/i);
    const letters = screen
      .getAllByTestId("challenge-week-day")
      .map((el) => el.textContent?.trim());
    expect(letters).toEqual(["L", "M", "X", "J", "V", "S", "D"]);
  });
});
