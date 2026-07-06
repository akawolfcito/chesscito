import { existsSync } from "node:fs";
import { resolve } from "node:path";
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
  it("exposes Learn branding without changing the training composition", () => {
    render(<HubLiteScaffold {...baseProps()} />);

    expect(screen.getByRole("main", { name: "Chesscito Learn home" })).toBeInTheDocument();
    expect(screen.getByText("21-Day Mind Challenge")).toBeInTheDocument();
    expect(screen.getByTestId("start-focus-cta")).toHaveTextContent("Start Focus");
  });

  it("responsive Lite image derivatives exist in public art", () => {
    const paths = [
      "art/avatar-lite-hub-224w.avif",
      "art/avatar-lite-hub-340w.avif",
      "art/avatar-lite-hub-224w.webp",
      "art/avatar-lite-hub-340w.webp",
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

  it("Start Focus: always labelled 'Start Focus' (not per-variant), routes on press", () => {
    const onPress = vi.fn();
    render(
      <HubLiteScaffold
        {...baseProps({
          primaryFocus: { onPress, contentLoop: action("daily-limit-reached"), isHydrated: true },
        })}
      />,
    );
    const cta = screen.getByTestId("start-focus-cta");
    // Stable label regardless of the content-loop variant.
    expect(cta.textContent).toMatch(/Start Focus/i);
    expect(cta.textContent).not.toMatch(/Practice|Continue/i);
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

  it("Start Focus: prioritizes the AVIF ring with intrinsic dimensions", () => {
    const { container } = render(<HubLiteScaffold {...baseProps()} />);
    const picture = container.querySelector(".hub-lite-start-focus-ring");
    const sources = picture?.querySelectorAll("source");
    const image = picture?.querySelector("img");

    expect(sources).toHaveLength(2);
    expect(sources?.[0]).toHaveAttribute("srcset", "/art/ring-start-focus.avif");
    expect(sources?.[1]).toHaveAttribute("srcset", "/art/ring-start-focus.webp");
    expect(image).toHaveAttribute("src", "/art/ring-start-focus.png");
    expect(image).toHaveAttribute("width", "512");
    expect(image).toHaveAttribute("height", "260");
    expect(image).toHaveAttribute("fetchpriority", "high");
    expect(image).toHaveAttribute("draggable", "false");
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
