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

  it("arches the glyphs without letting assistive tech spell the word out", () => {
    solveDaily();
    const accessible = screen.getByText(PHASE_FLASH_COPY.success);
    expect(accessible).toHaveClass("sr-only");

    const glyphs = Array.from(
      accessible.parentElement?.querySelectorAll('[aria-hidden="true"]') ?? [],
    );
    expect(glyphs).toHaveLength([...PHASE_FLASH_COPY.success].length);
    // Curved, not a straight line: the outer glyphs are rotated and dropped,
    // the middle one is not.
    const transforms = glyphs.map((g) => (g as HTMLElement).style.transform);
    expect(transforms[0]).toMatch(/rotate\(-\d/);
    expect(transforms[transforms.length - 1]).toMatch(/rotate\(\d/);
    expect(new Set(transforms).size).toBeGreaterThan(1);
  });

  it("shows the headline as authored — Title Case, never shouted by CSS", () => {
    expect(PHASE_FLASH_COPY.success).toBe("Well Done!");
    solveDaily();
    const headline = screen.getByText(PHASE_FLASH_COPY.success).parentElement;
    expect(headline?.style.textTransform).toBe("");
  });
});
