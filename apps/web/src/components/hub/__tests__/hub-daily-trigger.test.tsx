import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent } from "@testing-library/react";
import { renderWithIntl as render, screen } from "@/test-utils/render-with-intl";

import { HubDailyTrigger } from "../hub-daily-trigger";

const BASE = {
  iconSrc: "/art/new-icons-chesscito/daily-icon-v1.png",
  label: "Daily",
  ariaLabel: "Play today's focus",
  badge: <span data-testid="test-badge">3</span>,
};

afterEach(() => {
  cleanup();
});

describe("<HubDailyTrigger>", () => {
  it("tile variant: renders the HubActionTile (label + daily icon + badge)", () => {
    const onClick = vi.fn();
    render(<HubDailyTrigger variant="tile" {...BASE} onClick={onClick} />);

    expect(screen.getByText("Daily")).toBeInTheDocument();
    const img = document.querySelector("img");
    expect(img?.getAttribute("src")).toBe("/art/new-icons-chesscito/daily-icon-v1.png");
    expect(screen.getByTestId("test-badge")).toBeInTheDocument();
    // Not the corner affordance.
    expect(screen.queryByTestId("hub-daily-corner-icon")).toBeNull();

    fireEvent.click(screen.getByRole("button"));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("corner-icon variant: gift glyph + badge, no tile label, opens on tap", () => {
    const onClick = vi.fn();
    render(<HubDailyTrigger variant="corner-icon" {...BASE} onClick={onClick} />);

    const btn = screen.getByTestId("hub-daily-corner-icon");
    expect(btn).toBeInTheDocument();
    expect(btn).toHaveAttribute("aria-label", "Play today's focus");
    // Reuses the existing welcome-gift asset, not the daily tile icon.
    const img = btn.querySelector("img");
    expect(img?.getAttribute("src")).toBe("/art/shop/welcome-gift.png");
    expect(screen.getByTestId("test-badge")).toBeInTheDocument();
    // Corner is icon-only — the tile text label must not render.
    expect(screen.queryByText("Daily")).toBeNull();

    fireEvent.click(btn);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("corner-icon variant: respects disabled (completed today)", () => {
    const onClick = vi.fn();
    render(
      <HubDailyTrigger variant="corner-icon" {...BASE} disabled onClick={onClick} />,
    );
    const btn = screen.getByTestId("hub-daily-corner-icon");
    expect(btn).toBeDisabled();
    fireEvent.click(btn);
    expect(onClick).not.toHaveBeenCalled();
  });
});
