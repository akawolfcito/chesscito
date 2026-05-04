import { describe, it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { HudSecondaryRow } from "../hud-secondary-row";
import { HUD_COPY } from "@/lib/content/editorial";

describe("HudSecondaryRow", () => {
  it("returns null when no resources have content", () => {
    const { container } = render(
      <HudSecondaryRow streak={null} stars={null} shields={null} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("returns null when all resources are undefined", () => {
    const { container } = render(<HudSecondaryRow />);
    expect(container.firstChild).toBeNull();
  });

  it("renders a single streak chip wrapped in role=region with the aria-label from HUD_COPY", () => {
    render(
      <HudSecondaryRow streak={4} stars={null} shields={null} />,
    );

    const region = screen.getByRole("region", {
      name: HUD_COPY.secondaryRowAriaLabel,
    });
    expect(region).toBeInTheDocument();

    const chips = within(region).getAllByRole("status");
    expect(chips).toHaveLength(1);
    const streakChip = within(region).getByRole("status", {
      name: HUD_COPY.streakAriaLabel(4),
    });
    expect(streakChip.textContent).toContain(HUD_COPY.streakFormat(4));
  });

  it("renders only the stars chip when only stars are present", () => {
    render(
      <HudSecondaryRow
        streak={null}
        stars={{ current: 1, total: 3 }}
        shields={null}
      />,
    );
    const region = screen.getByRole("region");
    const chips = within(region).getAllByRole("status");
    expect(chips).toHaveLength(1);
    const starsChip = within(region).getByRole("status", {
      name: HUD_COPY.starsAriaLabel(1, 3),
    });
    expect(starsChip.textContent).toContain(HUD_COPY.starsFormat(1, 3));
  });

  it("renders only the shields chip when only shields are present", () => {
    render(<HudSecondaryRow streak={null} stars={null} shields={2} />);
    const region = screen.getByRole("region");
    const chips = within(region).getAllByRole("status");
    expect(chips).toHaveLength(1);
    const shieldsChip = within(region).getByRole("status", {
      name: HUD_COPY.shieldsAriaLabel(2),
    });
    expect(shieldsChip.textContent).toContain(HUD_COPY.shieldsFormat(2));
  });

  it("renders all three chips in streak → stars → shields order", () => {
    render(
      <HudSecondaryRow
        streak={4}
        stars={{ current: 2, total: 3 }}
        shields={2}
      />,
    );
    const region = screen.getByRole("region");
    const chips = within(region).getAllByRole("status");
    expect(chips).toHaveLength(3);
    expect(chips[0]).toHaveAccessibleName(HUD_COPY.streakAriaLabel(4));
    expect(chips[1]).toHaveAccessibleName(HUD_COPY.starsAriaLabel(2, 3));
    expect(chips[2]).toHaveAccessibleName(HUD_COPY.shieldsAriaLabel(2));
  });

  it("merges a custom className alongside the base classes on the region", () => {
    render(
      <HudSecondaryRow streak={1} className="extra-test-class" />,
    );
    const region = screen.getByRole("region");
    expect(region.className).toMatch(/hud-secondary-row\b/);
    expect(region.className).toMatch(/extra-test-class/);
  });

  describe("tap handlers", () => {
    it("renders the shields chip as a button when onShieldsTap is provided", () => {
      const onShieldsTap = vi.fn();
      render(<HudSecondaryRow shields={3} onShieldsTap={onShieldsTap} />);

      // HudResourceChip switches to <button> when onClick is set, which
      // exposes role="button" and removes role="status".
      const shieldsBtn = screen.getByRole("button", {
        name: HUD_COPY.shieldsAriaLabel(3),
      });
      expect(shieldsBtn).toBeInTheDocument();
    });

    it("invokes onShieldsTap when the shields chip is clicked", async () => {
      const user = userEvent.setup();
      const onShieldsTap = vi.fn();
      render(<HudSecondaryRow shields={2} onShieldsTap={onShieldsTap} />);

      await user.click(
        screen.getByRole("button", { name: HUD_COPY.shieldsAriaLabel(2) }),
      );

      expect(onShieldsTap).toHaveBeenCalledTimes(1);
    });

    it("invokes onStreakTap when the streak chip is clicked", async () => {
      const user = userEvent.setup();
      const onStreakTap = vi.fn();
      render(<HudSecondaryRow streak={5} onStreakTap={onStreakTap} />);

      await user.click(
        screen.getByRole("button", { name: HUD_COPY.streakAriaLabel(5) }),
      );

      expect(onStreakTap).toHaveBeenCalledTimes(1);
    });

    it("invokes onStarsTap when the stars chip is clicked", async () => {
      const user = userEvent.setup();
      const onStarsTap = vi.fn();
      render(
        <HudSecondaryRow
          stars={{ current: 1, total: 3 }}
          onStarsTap={onStarsTap}
        />,
      );

      await user.click(
        screen.getByRole("button", { name: HUD_COPY.starsAriaLabel(1, 3) }),
      );

      expect(onStarsTap).toHaveBeenCalledTimes(1);
    });

    it("renders chips as role=status (non-clickable) when no tap handler is provided", () => {
      render(<HudSecondaryRow shields={1} />);

      expect(
        screen.getByRole("status", { name: HUD_COPY.shieldsAriaLabel(1) }),
      ).toBeInTheDocument();
      expect(screen.queryByRole("button")).not.toBeInTheDocument();
    });
  });
});
