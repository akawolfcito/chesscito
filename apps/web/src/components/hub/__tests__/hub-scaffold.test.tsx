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
  playLabel: "PLAY",
  playAriaLabel: "Start training",
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

  it("mounts the PremiumSlot on the body right side and reflects the active state", () => {
    const { container } = render(<HubScaffold {...baseProps} />);
    const slot = container.querySelector(
      ".hub-scaffold-side--right .premium-slot",
    );
    expect(slot).not.toBeNull();
    expect(slot!.className).toMatch(/is-active\b/);
    expect(slot!.className).not.toMatch(/is-inactive\b/);
  });

  it("renders the inactive PremiumSlot CTA when PRO is inactive", () => {
    render(
      <HubScaffold {...baseProps} pro={{ active: false }} />,
    );
    expect(screen.getByText("Go PRO")).toBeInTheDocument();
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
    const cta = screen.getByRole("button", { name: "Start training" });
    expect(cta.className).toMatch(/primary-play-cta--playhub\b/);
    expect(cta.textContent).toContain("PLAY");
  });

  it("forwards the play press to the onPlayPress handler", async () => {
    const onPlayPress = vi.fn();
    const user = userEvent.setup();
    render(<HubScaffold {...baseProps} onPlayPress={onPlayPress} />);
    await user.click(screen.getByRole("button", { name: "Start training" }));
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
});
