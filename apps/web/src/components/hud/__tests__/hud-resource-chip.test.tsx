import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";

import { HudResourceChip } from "../hud-resource-chip";

describe("HudResourceChip", () => {
  it("renders the trophy tone with the trophy icon, value, role=status and aria-label", () => {
    const { container } = render(
      <HudResourceChip tone="trophy" value={15} ariaLabel="Trophies: 15" />,
    );

    const node = screen.getByRole("status", { name: "Trophies: 15" });
    expect(node).toBeInTheDocument();
    expect(node.textContent).toContain("15");
    expect(node).toHaveAttribute("aria-live", "polite");

    const sources = container.querySelectorAll("source");
    expect(sources[0]).toHaveAttribute(
      "srcset",
      "/art/redesign/icons/trophy.avif",
    );
    expect(node.className).toMatch(/hud-resource-chip\b/);
    expect(node.className).toMatch(/hud-resource-chip--trophy\b/);
  });

  it("renders the pro tone modifier and the crown icon", () => {
    const { container } = render(
      <HudResourceChip
        tone="pro"
        value="23d"
        ariaLabel="PRO active, 23 days remaining"
      />,
    );

    const node = screen.getByRole("status", { name: /PRO active/ });
    expect(node.className).toMatch(/hud-resource-chip--pro\b/);
    expect(node.textContent).toContain("23d");

    const sources = container.querySelectorAll("source");
    expect(sources[0]).toHaveAttribute(
      "srcset",
      "/art/redesign/icons/crown.avif",
    );
  });

  it("returns null when value is null", () => {
    const { container } = render(
      <HudResourceChip tone="trophy" value={null} ariaLabel="Trophies" />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("returns null when value is undefined", () => {
    const { container } = render(
      <HudResourceChip tone="trophy" value={undefined} ariaLabel="Trophies" />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders when value is 0 (not nullish)", () => {
    render(
      <HudResourceChip tone="trophy" value={0} ariaLabel="Trophies: 0" />,
    );
    const node = screen.getByRole("status", { name: "Trophies: 0" });
    expect(node.textContent).toContain("0");
  });

  it("applies the compact size modifier", () => {
    render(
      <HudResourceChip
        tone="default"
        size="compact"
        value={4}
        icon="time"
        ariaLabel="Streak: 4 days"
      />,
    );
    const node = screen.getByRole("status", { name: "Streak: 4 days" });
    expect(node.className).toMatch(/hud-resource-chip--compact\b/);
  });

  it("renders a button when onClick is provided", () => {
    const onClick = vi.fn();
    render(
      <HudResourceChip
        tone="pro"
        value="23d"
        ariaLabel="PRO"
        onClick={onClick}
      />,
    );
    const node = screen.getByRole("button", { name: "PRO" });
    expect(node.tagName.toLowerCase()).toBe("button");
    expect(node).toHaveAttribute("aria-live", "polite");
  });

  it("renders a span by default (no onClick)", () => {
    render(
      <HudResourceChip tone="trophy" value={15} ariaLabel="Trophies: 15" />,
    );
    const node = screen.getByRole("status", { name: "Trophies: 15" });
    expect(node.tagName.toLowerCase()).toBe("span");
  });

  it("uses the icon override on the default tone", () => {
    const { container } = render(
      <HudResourceChip
        tone="default"
        value={3}
        icon="shield"
        ariaLabel="3 retry shields available"
      />,
    );
    const sources = container.querySelectorAll("source");
    expect(sources[0]).toHaveAttribute(
      "srcset",
      "/art/redesign/icons/shield.avif",
    );
  });

  it("applies the pulse class on value updates and clears it after 240ms", () => {
    vi.useFakeTimers();
    try {
      const { rerender } = render(
        <HudResourceChip tone="trophy" value={15} ariaLabel="Trophies: 15" />,
      );

      const initialNode = screen.getByRole("status", { name: "Trophies: 15" });
      expect(initialNode.className).not.toMatch(/is-pulse\b/);

      rerender(
        <HudResourceChip tone="trophy" value={16} ariaLabel="Trophies: 16" />,
      );

      const pulsing = screen.getByRole("status", { name: "Trophies: 16" });
      expect(pulsing.className).toMatch(/is-pulse\b/);

      act(() => {
        vi.advanceTimersByTime(240);
      });

      const cleared = screen.getByRole("status", { name: "Trophies: 16" });
      expect(cleared.className).not.toMatch(/is-pulse\b/);
    } finally {
      vi.useRealTimers();
    }
  });
});
