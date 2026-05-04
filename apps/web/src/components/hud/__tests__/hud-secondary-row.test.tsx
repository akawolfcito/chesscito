import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";

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
});
