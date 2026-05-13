import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { HubScaffold } from "../hub-scaffold";
import type { RewardTile } from "@/components/kingdom/reward-column";

vi.mock("@/lib/haptics", () => ({
  hapticTap: () => {},
}));

const baseTiles: RewardTile[] = [
  { id: "rook", state: "claimable" },
  { id: "bishop", state: "progress" },
  { id: "knight", state: "locked" },
];

const baseProps = {
  trophies: 12,
  pro: { active: true as const, daysRemaining: 14 },
  streak: 3,
  stars: { current: 8, total: 12 },
  shields: 2,
  rewardTiles: baseTiles,
  premiumKicker: "Training Pass",
  premiumInactiveLabel: "Go PRO",
  premiumProgressFormat: (used: number, total: number) => `${used}/${total}`,
  premiumAriaLabel: "Training Pass progress",
  premiumUsed: 3,
  premiumTotal: 12,
  playLabel: "ENTER ARENA",
  playAriaLabel: "Enter the Arena",
};

describe("HubScaffold", () => {
  it("renders the canonical 3-zone layout regions", () => {
    const { container } = render(<HubScaffold {...baseProps} />);
    expect(container.querySelector(".hub-scaffold-hud")).not.toBeNull();
    expect(container.querySelector(".hub-scaffold-body")).not.toBeNull();
    expect(container.querySelector(".hub-scaffold-footer")).not.toBeNull();
  });

  it("mounts the trophy and PRO HUD chips with values from HUD_COPY formatters", () => {
    render(<HubScaffold {...baseProps} />);
    expect(screen.getByLabelText("Trophies: 12")).toBeInTheDocument();
    expect(screen.getByLabelText("PRO active, 14 days remaining")).toBeInTheDocument();
  });

  it("mounts the secondary HUD row when streak/stars/shields are present", () => {
    render(<HubScaffold {...baseProps} />);
    expect(screen.getByLabelText("Streak: 3 days")).toBeInTheDocument();
    expect(screen.getByLabelText("Stars: 8 of 12")).toBeInTheDocument();
    expect(screen.getByLabelText("2 retry shields available")).toBeInTheDocument();
  });

  it("collapses the secondary HUD row when all conditional resources are null", () => {
    const { container } = render(
      <HubScaffold
        {...baseProps}
        streak={null}
        stars={null}
        shields={null}
      />,
    );
    expect(container.querySelector(".hud-secondary-row")).toBeNull();
  });

  it("renders the active Coach PRO card from PRO status", () => {
    render(<HubScaffold {...baseProps} />);

    expect(screen.getByText("PRO Active · 14d")).toBeInTheDocument();
    expect(screen.getByText("Your Coach is ready.")).toBeInTheDocument();
    expect(screen.getByText("Reviews · History · Next training")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Open Journal" }),
    ).toBeInTheDocument();
  });

  it("renders the inactive Coach PRO card with preview chips", () => {
    render(<HubScaffold {...baseProps} pro={{ active: false }} />);

    expect(screen.getByText("Coach PRO")).toBeInTheDocument();
    expect(screen.getByText("Get feedback after games and practice.")).toBeInTheDocument();
    expect(screen.queryByText("Mistakes · Tips · History")).not.toBeInTheDocument();
    expect(screen.getByText("Mistakes")).toBeInTheDocument();
    expect(screen.getByText("Tips")).toBeInTheDocument();
    expect(screen.getByText("History")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Train with Coach" }),
    ).toBeInTheDocument();
  });

  it("forwards the Coach PRO card CTA to onCoachProCardCta", async () => {
    const onCoachProCardCta = vi.fn();
    const user = userEvent.setup();

    render(
      <HubScaffold
        {...baseProps}
        pro={{ active: false }}
        onCoachProCardCta={onCoachProCardCta}
      />,
    );

    await user.click(
      screen.getByRole("button", { name: "Train with Coach" }),
    );

    expect(onCoachProCardCta).toHaveBeenCalledTimes(1);
  });

  it("mounts the KingdomAnchor playhub variant in the body anchor zone", () => {
    const { container } = render(<HubScaffold {...baseProps} />);
    const anchor = container.querySelector(
      ".hub-scaffold-anchor .kingdom-anchor--playhub",
    );
    expect(anchor).not.toBeNull();
  });

  it("mounts the RewardColumn on the body left side", () => {
    const { container } = render(<HubScaffold {...baseProps} />);
    expect(
      container.querySelector(".hub-scaffold-side--left .reward-column"),
    ).not.toBeNull();
  });

  it("does not mount the PremiumSlot by default so the Coach PRO card is the primary PRO surface", () => {
    const { container } = render(<HubScaffold {...baseProps} />);
    const slot = container.querySelector(
      ".hub-scaffold-side--right .premium-slot",
    );
    expect(slot).toBeNull();
  });

  it("can still mount the PremiumSlot when explicitly requested", () => {
    const { container } = render(<HubScaffold {...baseProps} showPremiumSlot />);
    const slot = container.querySelector(
      ".hub-scaffold-side--right .premium-slot",
    );
    expect(slot).not.toBeNull();
    expect(slot!.className).toMatch(/is-active\b/);
  });

  it("keeps the inactive PremiumSlot hidden by default to avoid competing PRO CTAs", () => {
    render(
      <HubScaffold {...baseProps} pro={{ active: false }} />,
    );
    expect(screen.queryByText("Go PRO")).not.toBeInTheDocument();
  });

  it("collapses the PRO HUD chip when PRO is inactive (value === null)", () => {
    const { container } = render(
      <HubScaffold {...baseProps} pro={{ active: false }} />,
    );
    expect(
      container.querySelector(".hud-resource-chip--pro"),
    ).toBeNull();
  });

  it("mounts the MissionRibbon hub variant in the footer", () => {
    const { container } = render(<HubScaffold {...baseProps} />);
    expect(
      container.querySelector(".hub-scaffold-footer .mission-ribbon--hub"),
    ).not.toBeNull();
  });

  it("mounts the dominant PrimaryPlayCta playhub variant in the footer", () => {
    render(<HubScaffold {...baseProps} />);
    const cta = screen.getByRole("button", { name: "Enter the Arena" });
    expect(cta.className).toMatch(/primary-play-cta--playhub\b/);
    expect(cta.textContent).toContain("ENTER ARENA");
  });

  it("forwards the play press to the onPlayPress handler", async () => {
    const onPlayPress = vi.fn();
    const user = userEvent.setup();
    render(<HubScaffold {...baseProps} onPlayPress={onPlayPress} />);
    await user.click(screen.getByRole("button", { name: "Enter the Arena" }));
    expect(onPlayPress).toHaveBeenCalledTimes(1);
  });

  it("forwards the trophy chip tap to onTrophyTap", async () => {
    const onTrophyTap = vi.fn();
    const user = userEvent.setup();
    render(<HubScaffold {...baseProps} onTrophyTap={onTrophyTap} />);
    await user.click(screen.getByLabelText("Trophies: 12"));
    expect(onTrophyTap).toHaveBeenCalledTimes(1);
  });

  it("uses the canonical play-hub aria-label on the main region", () => {
    render(<HubScaffold {...baseProps} />);
    expect(screen.getByRole("main", { name: "Chesscito Hub" })).toBeInTheDocument();
  });

  describe("secondaryAction", () => {
    it("does not render a secondary link when the prop is omitted", () => {
      const { container } = render(<HubScaffold {...baseProps} />);
      expect(
        container.querySelector(".hub-scaffold-practice-cta"),
      ).toBeNull();
    });

    it("renders the secondary link with the provided label + aria-label", () => {
      render(
        <HubScaffold
          {...baseProps}
          secondaryAction={{
            label: "Practice pieces",
            ariaLabel: "Practice individual chess pieces",
            onPress: () => {},
          }}
        />,
      );
      const link = screen.getByRole("button", {
        name: "Practice individual chess pieces",
      });
      expect(link.textContent).toBe("Practice pieces");
      expect(link.className).toMatch(/primary-play-cta--playhub/);
      expect(link.className).toMatch(/hub-scaffold-practice-cta/);
    });

    it("forwards the tap to the onPress handler", async () => {
      const onPress = vi.fn();
      const user = userEvent.setup();
      render(
        <HubScaffold
          {...baseProps}
          secondaryAction={{
            label: "Practice pieces",
            ariaLabel: "Practice individual chess pieces",
            onPress,
          }}
        />,
      );
      await user.click(
        screen.getByRole("button", {
          name: "Practice individual chess pieces",
        }),
      );
      expect(onPress).toHaveBeenCalledTimes(1);
    });
  });
});
