import { describe, it, expect, vi } from "vitest";
import { screen, within } from "@testing-library/react";

import { renderWithIntl as render } from "@/test-utils/render-with-intl";
import { PiecePickerTrigger } from "../piece-picker-trigger";

/**
 * The counter chip on the piece trigger (founder 2026-08-09).
 *
 * WHY A FLOATING CHIP AND NOT TEXT INSIDE THE PILL
 * ------------------------------------------------
 * The pill's own label already loses: it renders with `min-w-0 truncate` in a
 * row that competes with the stars/shield/streak/peones pills, so as those
 * numbers grow the piece NAME is what gives way — the founder's screenshot
 * shows the pill down to just the icon. Adding "3/8" as more text inside would
 * be handing it to the same squeeze. The chip floats in the corner, out of the
 * width contest, and reuses the exact shape the hub tile already shows so the
 * player recognises it instead of learning it.
 */
describe("<PiecePickerTrigger> — progress chip", () => {
  it("renders the counter chip when progress is supplied", () => {
    render(
      <PiecePickerTrigger
        selectedPiece="rook"
        onClick={vi.fn()}
        showLabel
        progress={{ completed: 3, required: 8 }}
      />,
    );

    const trigger = screen.getByRole("button");
    const chip = within(trigger).getByTestId("piece-picker-progress");
    expect(chip.textContent).toBe("3/8");
    // The count reaches assistive tech through the button's aria-label, so the
    // chip itself must stay out of the a11y tree.
    expect(chip).toHaveAttribute("aria-hidden", "true");
  });

  it("renders no chip when progress is absent", () => {
    render(
      <PiecePickerTrigger selectedPiece="rook" onClick={vi.fn()} showLabel />,
    );

    expect(screen.queryByTestId("piece-picker-progress")).toBeNull();
  });

  it("shares the hub tile's chip class so the two surfaces cannot drift apart", () => {
    render(
      <PiecePickerTrigger
        selectedPiece="rook"
        onClick={vi.fn()}
        showLabel
        progress={{ completed: 3, required: 8 }}
      />,
    );

    // Not cosmetic pedantry: two copies of the same chip geometry are invisible
    // to every behavioural test — the original changes, the copy does not, and
    // nobody finds out until the two screens visibly disagree.
    const chip = screen.getByTestId("piece-picker-progress");
    expect(chip.className).toMatch(/progress-count-chip\b/);
  });

  /**
   * PAST THE GATE, THE FRACTION STOPS AND A "+" TAKES OVER
   * -----------------------------------------------------
   * The denominator is the badge GATE (80% of the pool), so a player who solves
   * the whole pool has done MORE than the fraction can express — that is where
   * "9/8" came from. The numerator now stops at the gate, and `extra` carries
   * what is beyond it.
   *
   * ⛔ A "+" and not a star icon: ★ is already the reward metric in the HUD
   * (`totalStars`), and this gate was deliberately moved OFF stars onto
   * completion. A star here would put the two meanings on one chip.
   */
  it("appends a + when the player is past the gate", () => {
    render(
      <PiecePickerTrigger
        selectedPiece="bishop"
        onClick={vi.fn()}
        showLabel
        progress={{ completed: 8, required: 8, extra: 1 }}
      />,
    );

    const chip = screen.getByTestId("piece-picker-progress");
    expect(chip.textContent).toBe("8/8+");
  });

  it("shows no + when the player landed exactly on the gate", () => {
    render(
      <PiecePickerTrigger
        selectedPiece="bishop"
        onClick={vi.fn()}
        showLabel
        progress={{ completed: 8, required: 8, extra: 0 }}
      />,
    );

    expect(screen.getByTestId("piece-picker-progress").textContent).toBe("8/8");
  });

  it("tells assistive tech how much is beyond the gate, since the + cannot", () => {
    render(
      <PiecePickerTrigger
        selectedPiece="bishop"
        onClick={vi.fn()}
        showLabel
        progress={{ completed: 8, required: 8, extra: 2 }}
      />,
    );

    // The chip is aria-hidden, so a screen reader gets the count from here or
    // not at all — and "+" is not a number.
    expect(screen.getByRole("button").getAttribute("aria-label")).toMatch(
      /\b2\b/,
    );
  });
});
