import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

import { HubProBadge } from "../hub-pro-badge";

describe("<HubProBadge>", () => {
  it("renders the PRO title + inactive subline when inactive", () => {
    render(
      <HubProBadge
        active={false}
        sublineInactive="Unlock the full experience"
        ariaLabel="PRO inactive: tap to learn more"
      />,
    );
    const root = screen.getByLabelText(/PRO inactive/);
    expect(root).toHaveTextContent("PRO");
    expect(root).toHaveTextContent(/Unlock the full experience/);
  });

  it("applies the inactive modifier class on the inactive variant", () => {
    render(
      <HubProBadge
        active={false}
        sublineInactive="x"
        ariaLabel="x"
      />,
    );
    expect(screen.getByLabelText("x").className).toContain(
      "hub-pro-badge--inactive",
    );
  });

  it("renders PRO + days label as the subline when active", () => {
    render(
      <HubProBadge
        active
        daysRemaining={7}
        daysLabel="7d"
        ariaLabel="PRO active, 7 days remaining"
      />,
    );
    const root = screen.getByLabelText(/PRO active/);
    expect(root).toHaveTextContent("PRO");
    expect(root).toHaveTextContent("7d");
  });

  it("hides the inactive promo copy when active (days replaces subline)", () => {
    render(
      <HubProBadge
        active
        daysRemaining={7}
        daysLabel="7d"
        sublineInactive="Unlock the full experience"
        ariaLabel="x"
      />,
    );
    expect(screen.getByLabelText("x")).not.toHaveTextContent(
      /Unlock the full experience/,
    );
  });

  it("applies the active modifier class on the active variant", () => {
    render(
      <HubProBadge active daysRemaining={7} daysLabel="7d" ariaLabel="x" />,
    );
    expect(screen.getByLabelText("x").className).toContain(
      "hub-pro-badge--active",
    );
  });

  it("renders the panel-pro background image (visual identity preserved)", () => {
    const { container } = render(
      <HubProBadge active={false} sublineInactive="x" ariaLabel="x" />,
    );
    const img = container.querySelector(".hub-pro-badge-bg img");
    expect(img).not.toBeNull();
    expect(img?.getAttribute("src")).toContain("/art/hub/panel-pro.png");
  });

  it("renders as a <button> when onClick is provided", () => {
    render(
      <HubProBadge
        active={false}
        sublineInactive="x"
        ariaLabel="x"
        onClick={vi.fn()}
      />,
    );
    expect(screen.getByLabelText("x").tagName).toBe("BUTTON");
  });

  it("renders as a non-interactive status element when onClick is omitted", () => {
    render(
      <HubProBadge active={false} sublineInactive="x" ariaLabel="x" />,
    );
    const root = screen.getByLabelText("x");
    expect(root.tagName).not.toBe("BUTTON");
    expect(root.getAttribute("role")).toBe("status");
  });

  it("fires onClick when tapped (inactive)", () => {
    const onClick = vi.fn();
    render(
      <HubProBadge
        active={false}
        sublineInactive="x"
        ariaLabel="x"
        onClick={onClick}
      />,
    );
    fireEvent.click(screen.getByLabelText("x"));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
