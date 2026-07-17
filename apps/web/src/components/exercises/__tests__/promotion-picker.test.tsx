import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";

import { PromotionPicker } from "@/components/exercises/promotion-picker";
import messages from "@/lib/content/messages/en";

/** Stage 10. The picker is the mechanic, not chrome (P3/P5) — auto-queen is
 *  dead precisely so this choice exists.
 *
 *  Founder, 2026-07-16, on what the choice is FOR at this stage: the player
 *  does not know how to play a knight yet, so the lesson cannot be "crown a
 *  knight and you mate". It is that promotion SUMMONS a piece of your choosing.
 *  So the mission is stated plainly here — "summon a knight" — and getting it
 *  wrong is a mistake the player can see coming, not a gotcha. */

const renderPicker = (props: Partial<Parameters<typeof PromotionPicker>[0]> = {}) =>
  render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <PromotionPicker promoteTo="knight" onPick={vi.fn()} {...props} />
    </NextIntlClientProvider>,
  );

describe("PromotionPicker", () => {
  it("offers every piece a pawn may become", () => {
    // All four, always. Offering only the asked piece would make the picker
    // theatre: with no choice, choosing is not the mechanic.
    renderPicker();

    for (const piece of ["queen", "rook", "bishop", "knight"]) {
      expect(screen.getByTestId(`pr-picker-option-${piece}`)).toBeInTheDocument();
    }
  });

  it("never offers a king or another pawn", () => {
    // Not a preference — a pawn cannot crown either, so a mission naming one is
    // an unwinnable level the content lint rejects at import.
    renderPicker();

    expect(screen.queryByTestId("pr-picker-option-king")).toBeNull();
    expect(screen.queryByTestId("pr-picker-option-pawn")).toBeNull();
  });

  it("names the mission's piece in the prompt — the founder's whole condition", () => {
    // "siempre y cuando en el modal se le muestre de manera clara cual es la
    // mision". Failing a choice the player was never told is a gotcha.
    renderPicker({ promoteTo: "knight" });

    expect(screen.getByTestId("pr-picker-mission")).toHaveTextContent(/knight/i);
  });

  it("reports the piece the player picked, right or wrong", () => {
    // The picker does not judge — the host owns the consequence. It reports.
    const onPick = vi.fn();
    renderPicker({ promoteTo: "knight", onPick });

    return userEvent
      .click(screen.getByTestId("pr-picker-option-rook"))
      .then(() => {
        expect(onPick).toHaveBeenCalledWith("rook");
      });
  });

  it("reports the asked piece the same way", async () => {
    const onPick = vi.fn();
    renderPicker({ promoteTo: "knight", onPick });

    await userEvent.click(screen.getByTestId("pr-picker-option-knight"));

    expect(onPick).toHaveBeenCalledWith("knight");
  });

  it("is a real modal — one aria-modal surface", () => {
    // ⚠️ Counting role="dialog" is the trap: LabyrinthCompleteOverlay uses
    // role="alert", so a role count passes green with two dialogs on screen.
    renderPicker();

    expect(document.querySelectorAll('[aria-modal="true"]')).toHaveLength(1);
  });

  it("cannot be dismissed — the pawn is ON the last rank", async () => {
    // There is no "not now": the run is over either way, and a pawn that
    // reached the edge MUST become something. A scrim tap that closed this
    // would leave the board in a state chess does not have.
    const onPick = vi.fn();
    renderPicker({ onPick });

    await userEvent.click(screen.getByTestId("pr-picker"));

    expect(onPick).not.toHaveBeenCalled();
  });
});
