import { describe, it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { PremiumSlot } from "../premium-slot";

const baseProps = {
  kicker: "Training Pass",
  inactiveCtaLabel: "Start training",
  progressFormat: (used: number, total: number) => `${used} / ${total}`,
  ariaLabel: "Training Pass",
};

describe("PremiumSlot", () => {
  it("renders the inactive state with the CTA copy when active is false", () => {
    render(
      <PremiumSlot {...baseProps} active={false} ariaLabel="Start training — PRO inactive" />,
    );
    const tile = screen.getByRole("button", { name: "Start training — PRO inactive" });
    expect(tile.className).toMatch(/premium-slot\b/);
    expect(tile.className).toMatch(/is-inactive\b/);
    expect(tile.textContent).toContain("Start training");
    expect(tile.textContent).not.toContain("Training Pass");
    expect(within(tile).queryByTestId("premium-slot-progress")).toBeNull();
  });

  it("renders the active state with kicker, progress bar at 60%, and the formatted X / Y", () => {
    render(
      <PremiumSlot
        {...baseProps}
        active
        usedSessions={6}
        totalSessions={10}
        daysRemaining={23}
        ariaLabel="Training Pass — 6 of 10 sessions, 23 days remaining"
      />,
    );
    const tile = screen.getByRole("button", {
      name: "Training Pass — 6 of 10 sessions, 23 days remaining",
    });
    expect(tile.className).toMatch(/is-active\b/);
    expect(tile.textContent).toContain("Training Pass");
    expect(tile.textContent).toContain("6 / 10");

    const fill = within(tile).getByTestId("premium-slot-progress-fill");
    expect(fill).toHaveStyle({ width: "60%" });
  });

  it("applies the expiring modifier when active and daysRemaining is 3 or less", () => {
    render(
      <PremiumSlot
        {...baseProps}
        active
        usedSessions={9}
        totalSessions={10}
        daysRemaining={2}
        ariaLabel="Training Pass — expiring"
      />,
    );
    const tile = screen.getByRole("button", { name: "Training Pass — expiring" });
    expect(tile.className).toMatch(/is-expiring\b/);
    expect(tile.textContent).toContain("Training Pass");
  });

  it("applies the recently-renewed modifier when the prop is set on top of active", () => {
    render(
      <PremiumSlot
        {...baseProps}
        active
        usedSessions={0}
        totalSessions={10}
        daysRemaining={30}
        recentlyRenewed
        ariaLabel="Training Pass — just renewed"
      />,
    );
    const tile = screen.getByRole("button", { name: "Training Pass — just renewed" });
    expect(tile.className).toMatch(/is-recently-renewed\b/);
    expect(tile.className).toMatch(/is-active\b/);
  });

  it("clamps the progress bar fill at 100% when usedSessions exceeds totalSessions", () => {
    render(
      <PremiumSlot
        {...baseProps}
        active
        usedSessions={15}
        totalSessions={10}
        daysRemaining={5}
        ariaLabel="Training Pass — over"
      />,
    );
    const fill = screen.getByTestId("premium-slot-progress-fill");
    expect(fill).toHaveStyle({ width: "100%" });
  });

  it("renders 0% width when totalSessions is 0 (defensive)", () => {
    render(
      <PremiumSlot
        {...baseProps}
        active
        usedSessions={0}
        totalSessions={0}
        daysRemaining={0}
        ariaLabel="Training Pass — empty"
      />,
    );
    const fill = screen.getByTestId("premium-slot-progress-fill");
    expect(fill).toHaveStyle({ width: "0%" });
  });

  it("fires onTap when the slot is clicked", async () => {
    const onTap = vi.fn();
    const user = userEvent.setup();
    render(
      <PremiumSlot {...baseProps} active={false} onTap={onTap} ariaLabel="Start training" />,
    );
    await user.click(screen.getByRole("button", { name: "Start training" }));
    expect(onTap).toHaveBeenCalledTimes(1);
  });

  it("renders a <button type='button'> with the aria-label from the prop", () => {
    render(
      <PremiumSlot {...baseProps} active={false} ariaLabel="Start training" />,
    );
    const tile = screen.getByRole("button", { name: "Start training" });
    expect(tile.tagName.toLowerCase()).toBe("button");
    expect(tile).toHaveAttribute("type", "button");
  });

  it("merges a custom className alongside the base classes", () => {
    render(
      <PremiumSlot
        {...baseProps}
        active={false}
        ariaLabel="Start training"
        className="extra-test-class"
      />,
    );
    const tile = screen.getByRole("button", { name: "Start training" });
    expect(tile.className).toMatch(/premium-slot\b/);
    expect(tile.className).toMatch(/extra-test-class/);
  });

  it("invokes the progressFormat callback with usedSessions and totalSessions", () => {
    const progressFormat = vi.fn((used: number, total: number) => `${used}/${total}`);
    render(
      <PremiumSlot
        {...baseProps}
        progressFormat={progressFormat}
        active
        usedSessions={3}
        totalSessions={5}
        daysRemaining={10}
        ariaLabel="Training Pass"
      />,
    );
    expect(progressFormat).toHaveBeenCalledWith(3, 5);
  });
});
