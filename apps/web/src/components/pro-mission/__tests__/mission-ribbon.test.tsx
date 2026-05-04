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

  it("renders the landing-cta-bar surface copy (Spanish per LANDING_COPY v0.5)", () => {
    render(<MissionRibbon surface="landing-cta-bar" />);
    const node = screen.getByRole("note");
    expect(node.textContent).toBe(MISSION_RIBBON_COPY["landing-cta-bar"]);
    expect(node.className).toMatch(/mission-ribbon--landing-cta-bar\b/);
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

  it("never weakens the canon framing — copy is sourced from MISSION_RIBBON_COPY (no inline strings)", () => {
    const surfaces = ["hub", "arena", "pro-sheet", "landing-cta-bar"] as const;
    for (const surface of surfaces) {
      const { unmount } = render(<MissionRibbon surface={surface} />);
      const node = screen.getByRole("note");
      expect(node.textContent).toBe(MISSION_RIBBON_COPY[surface]);
      unmount();
    }
  });
});
