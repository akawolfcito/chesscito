import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

import { HubProBadge } from "../hub-pro-badge";

describe("<HubProBadge>", () => {
  it("renders the inactive label as the only chip copy", () => {
    render(
      <HubProBadge active={false} sublineInactive="Unlock" ariaLabel="PRO inactive: tap to learn more" />,
    );
    const root = screen.getByLabelText(/PRO inactive/);
    expect(root).toHaveTextContent("Unlock");
    // "PRO" is painted into the chip art now — a DOM copy would double it.
    expect(root.textContent).not.toMatch(/PRO/);
  });

  it("applies the inactive modifier class on the inactive variant", () => {
    render(<HubProBadge active={false} sublineInactive="x" ariaLabel="x" />);
    expect(screen.getByLabelText("x").className).toContain("hub-pro-badge--inactive");
  });

  it("renders the days label as the chip copy when active", () => {
    render(
      <HubProBadge active daysRemaining={7} daysLabel="7d" ariaLabel="PRO active, 7 days remaining" />,
    );
    const root = screen.getByLabelText(/PRO active/);
    expect(root).toHaveTextContent("7d");
    expect(root.textContent).not.toMatch(/PRO/);
  });

  it("hides the inactive promo copy when active (days replaces it)", () => {
    render(
      <HubProBadge
        active
        daysRemaining={7}
        daysLabel="7d"
        sublineInactive="Unlock"
        ariaLabel="x"
      />,
    );
    expect(screen.getByLabelText("x")).not.toHaveTextContent(/Unlock/);
  });

  it("applies the active modifier class on the active variant", () => {
    render(<HubProBadge active daysRemaining={7} daysLabel="7d" ariaLabel="x" />);
    expect(screen.getByLabelText("x").className).toContain("hub-pro-badge--active");
  });

  it("carries the copy in a floating label anchored to the chip foot", () => {
    const { container } = render(
      <HubProBadge active={false} sublineInactive="Unlock" ariaLabel="x" />,
    );
    const label = container.querySelector(".hub-pro-badge-label");
    expect(label).not.toBeNull();
    expect(label?.textContent).toBe("Unlock");
  });

  it("renders the purple pro-chip-inactive frame when inactive", () => {
    const { container } = render(
      <HubProBadge active={false} sublineInactive="x" ariaLabel="x" />,
    );
    const img = container.querySelector(".hub-pro-badge-bg img");
    expect(img?.getAttribute("src")).toContain("/art/hub/pro-chip-inactive.png");
  });

  it("swaps to the gold pro-chip-active frame when active", () => {
    const { container } = render(
      <HubProBadge active daysRemaining={7} daysLabel="7d" ariaLabel="x" />,
    );
    const img = container.querySelector(".hub-pro-badge-bg img");
    expect(img?.getAttribute("src")).toContain("/art/hub/pro-chip-active.png");
  });

  it("renders as a <button> when onClick is provided", () => {
    render(<HubProBadge active={false} sublineInactive="x" ariaLabel="x" onClick={vi.fn()} />);
    expect(screen.getByLabelText("x").tagName).toBe("BUTTON");
  });

  it("renders as a non-interactive status element when onClick is omitted", () => {
    render(<HubProBadge active={false} sublineInactive="x" ariaLabel="x" />);
    const root = screen.getByLabelText("x");
    expect(root.tagName).not.toBe("BUTTON");
    expect(root.getAttribute("role")).toBe("status");
  });

  it("fires onClick when tapped (inactive)", () => {
    const onClick = vi.fn();
    render(<HubProBadge active={false} sublineInactive="x" ariaLabel="x" onClick={onClick} />);
    fireEvent.click(screen.getByLabelText("x"));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
