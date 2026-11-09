import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

import { MissionRibbon } from "../mission-ribbon";
import { MISSION_RIBBON_COPY } from "@/lib/content/editorial";

describe("MissionRibbon", () => {
  it("renders the hub surface copy with role=note + aria-label from MISSION_RIBBON_COPY", () => {
    render(<MissionRibbon surface="hub" />);
    const node = screen.getByRole("note", {
      name: MISSION_RIBBON_COPY.ariaLabel,
    });
    expect(node.textContent).toBe(MISSION_RIBBON_COPY.hub);
    expect(node.className).toMatch(/mission-ribbon\b/);
    expect(node.className).toMatch(/mission-ribbon--hub\b/);
  });

  it("renders the arena surface copy", () => {
    render(<MissionRibbon surface="arena" />);
    const node = screen.getByRole("note", {
      name: MISSION_RIBBON_COPY.ariaLabel,
    });
    expect(node.textContent).toBe(MISSION_RIBBON_COPY.arena);
    expect(node.className).toMatch(/mission-ribbon--arena\b/);
  });

  it("renders the pro-sheet surface copy (aliases PRO_COPY.tagline)", () => {
    render(<MissionRibbon surface="pro-sheet" />);
    const node = screen.getByRole("note");
    expect(node.textContent).toBe(MISSION_RIBBON_COPY["pro-sheet"]);
    expect(node.className).toMatch(/mission-ribbon--pro-sheet\b/);
  });

  it("applies the default tone modifier by default", () => {
    render(<MissionRibbon surface="hub" />);
    const node = screen.getByRole("note");
    expect(node.className).toMatch(/mission-ribbon--tone-default\b/);
    expect(node.className).not.toMatch(/mission-ribbon--tone-emphatic\b/);
  });

  it("applies the emphatic tone modifier when tone=emphatic", () => {
    render(<MissionRibbon surface="pro-sheet" tone="emphatic" />);
    const node = screen.getByRole("note");
    expect(node.className).toMatch(/mission-ribbon--tone-emphatic\b/);
    expect(node.className).not.toMatch(/mission-ribbon--tone-default\b/);
  });

  it("merges a custom className alongside the base classes", () => {
    render(<MissionRibbon surface="hub" className="extra-test-class" />);
    const node = screen.getByRole("note");
    expect(node.className).toMatch(/mission-ribbon\b/);
    expect(node.className).toMatch(/extra-test-class/);
  });

  it("applies the adventure atmosphere by default", () => {
    render(<MissionRibbon surface="hub" />);
    const node = screen.getByRole("note");
    expect(node.className).toMatch(/is-atmosphere-adventure\b/);
    expect(node.className).not.toMatch(/is-atmosphere-scholarly\b/);
  });

  it("applies the scholarly atmosphere when atmosphere='scholarly' (PRO sheet hybrid)", () => {
    render(<MissionRibbon surface="pro-sheet" atmosphere="scholarly" />);
    const node = screen.getByRole("note");
    expect(node.className).toMatch(/is-atmosphere-scholarly\b/);
    expect(node.className).not.toMatch(/is-atmosphere-adventure\b/);
  });

  it("never weakens the canon framing — copy is sourced from MISSION_RIBBON_COPY (no inline strings)", () => {
    const surfaces = ["hub", "arena", "pro-sheet"] as const;
    for (const surface of surfaces) {
      const { unmount } = render(<MissionRibbon surface={surface} />);
      const node = screen.getByRole("note");
      expect(node.textContent).toBe(MISSION_RIBBON_COPY[surface]);
      unmount();
    }
  });

  it("renders the new exercises surface with fallback copy from MISSION_RIBBON_COPY.exercises", () => {
    render(<MissionRibbon surface="exercises" />);
    const node = screen.getByRole("note", {
      name: MISSION_RIBBON_COPY.ariaLabel,
    });
    expect(node.textContent).toBe(MISSION_RIBBON_COPY.exercises);
    expect(node.className).toMatch(/mission-ribbon--exercises\b/);
  });

  it("renders the text override when text prop is provided (instead of MISSION_RIBBON_COPY[surface])", () => {
    const override = "The rook moves in straight lines.";
    render(<MissionRibbon surface="exercises" text={override} />);
    const node = screen.getByRole("note");
    expect(node.textContent).toBe(override);
    // Ensure the override actually replaces the fallback rather than appending.
    expect(node.textContent).not.toBe(MISSION_RIBBON_COPY.exercises);
  });

  it("falls back to MISSION_RIBBON_COPY[surface] when text prop is omitted (existing callsites untouched)", () => {
    render(<MissionRibbon surface="hub" />);
    const node = screen.getByRole("note");
    expect(node.textContent).toBe(MISSION_RIBBON_COPY.hub);
  });
});
