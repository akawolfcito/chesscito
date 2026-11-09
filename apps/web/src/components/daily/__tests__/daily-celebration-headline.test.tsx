import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup } from "@testing-library/react";
import { fireEvent, renderWithIntl as render, screen } from "@/test-utils/render-with-intl";

import { DailyTacticSheet } from "../daily-tactic-sheet";
import { PHASE_FLASH_COPY } from "@/lib/content/editorial";
import type { DailyTacticData } from "@/lib/daily/daily-puzzles";

/**
 * The Daily celebration headline used to be a picture with the English words
 * baked in, so the overlay stayed in English in every locale while the
 * exercises one translated. It reads the same PHASE_FLASH_COPY namespace now.
 *
 * The overlay only mounts in LEARN, so the flag is mocked file-wide — which is
 * why these live apart from daily-tactic-sheet.test.tsx.
 */
vi.mock("@/lib/feature-flags", () => ({ CHESSCITO_LITE_MODE: true }));

const PUZZLE: DailyTacticData = {
  id: "test-dt-rook-1",
  name: "Rook — horizontal slide",
  piece: "rook",
  exercise: {
    id: "test-dt-rook-1",
    startPos: { file: 0, rank: 0 },
    targetPos: { file: 7, rank: 0 },
    optimalMoves: 1,
  },
  hint: "Slide the rook along the rank.",
};

afterEach(() => {
  cleanup();
});

function solveDaily(): void {
  render(
    <DailyTacticSheet
      open
      onOpenChange={vi.fn()}
      puzzleData={PUZZLE}
      onSolve={vi.fn()}
    />,
  );
  fireEvent.click(screen.getByRole("gridcell", { name: "Square a1" }));
  fireEvent.click(screen.getByRole("gridcell", { name: "Square h1" }));
}

describe("Daily celebration headline", () => {
  it("renders translatable text, not the retired baked-in art", () => {
    solveDaily();
    expect(screen.getByText(PHASE_FLASH_COPY.success)).toBeInTheDocument();
    expect(
      document.querySelector('[data-theme-slot="daily.welldone"]'),
    ).toBeNull();
    expect(screen.queryByAltText(/well done/i)).toBeNull();
  });

  it("curves the word along a real circular arc", () => {
    solveDaily();
    const onPath = screen.getByText(PHASE_FLASH_COPY.success);
    expect(onPath.tagName.toLowerCase()).toBe("textpath");

    // The path it rides is an SVG elliptical-arc segment with both radii
    // equal — a circle. A straight baseline (or the old per-glyph tent, which
    // approximated the curve with transforms) would not produce one.
    const href = onPath.getAttribute("href");
    const path = document.querySelector(`path${href}`);
    const [, rx, ry] = /A ([\d.]+) ([\d.]+)/.exec(path?.getAttribute("d") ?? "") ?? [];
    expect(Number(rx)).toBeGreaterThan(0);
    expect(Number(ry)).toBe(Number(rx));
  });

  it("says the whole word to assistive tech instead of spelling it out", () => {
    solveDaily();
    // One labelled image, not one node per glyph. (Queried through the DOM
    // rather than by role: this whole overlay sits inside an aria-hidden
    // scrim, so the role query would never reach it.)
    const svg = screen.getByText(PHASE_FLASH_COPY.success).closest("svg");
    expect(svg?.getAttribute("role")).toBe("img");
    expect(svg?.getAttribute("aria-label")).toBe(PHASE_FLASH_COPY.success);
    // Every layer of the sign edge (shadow, extrusion, gold, keyline, fill)
    // is a <use> clone, so the string itself is in the DOM exactly once.
    expect(screen.getAllByText(PHASE_FLASH_COPY.success)).toHaveLength(1);
    expect(svg?.querySelectorAll("use")).toHaveLength(5);
  });

  it("shows the headline as authored — Title Case, never shouted by CSS", () => {
    expect(PHASE_FLASH_COPY.success).toBe("Well Done!");
    solveDaily();
    const text = screen.getByText(PHASE_FLASH_COPY.success).closest("text");
    expect(text?.style.textTransform).toBe("");
  });
});
