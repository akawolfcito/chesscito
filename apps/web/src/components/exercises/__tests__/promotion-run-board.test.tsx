import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";

import { PromotionRunBoard } from "@/components/exercises/promotion-run-board";
import messages from "@/lib/content/messages/en";
import type { Exercise } from "@/lib/game/types";

/** Stage 9. Sibling of <SafePathBoard>, and the tests that matter are the ones
 *  that are NOT shared with it:
 *
 *  - the attack map is LIVE (P2). The rook on b7 watches b8 down the b-file, so
 *    the only winning square is fatal until the pawn EATS the piece watching it.
 *    A board that memoised the map the way Safe Path does (its enemies are
 *    untouchable, D1) would make this level unwinnable.
 *  - the black pieces are victims AND eyes, at once.
 *  - there is no target square. The pawn wins by reaching a RANK.
 *
 *  Measured against the pure module before it was written here, not reasoned:
 *  c7 is a legal push and a grave, and xb7 -> b8 is the only run.
 */
const LEVEL: Exercise = {
  id: "pr-test",
  startPos: { file: 2, rank: 5 }, // c6
  // Targetless kind: the catalog sets targetPos = startPos and nothing reads it.
  targetPos: { file: 2, rank: 5 },
  optimalMoves: 2,
  enemies: [{ pos: { file: 1, rank: 6 }, piece: "rook" }], // b7
  mission: { promoteTo: "queen" },
};

const renderBoard = (
  props: Partial<Parameters<typeof PromotionRunBoard>[0]> = {},
) =>
  render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <PromotionRunBoard level={LEVEL} {...props} />
    </NextIntlClientProvider>,
  );

const tap = async (sq: string) => {
  const cell = document.querySelector(`[data-square="${sq}"]`);
  if (!cell) throw new Error(`no cell for ${sq}`);
  await userEvent.click(cell as HTMLElement);
};

/** The pawn deselects after every move, like every other board in the lane. */
const step = async (from: string, to: string) => {
  await tap(from);
  await tap(to);
};

describe("PromotionRunBoard — the live map", () => {
  it("draws the enemy as its real piece", () => {
    renderBoard();

    expect(screen.getByTestId("pr-enemy-b7")).toHaveAttribute(
      "data-piece",
      "rook",
    );
  });

  it("does NOT draw the watched squares — reading them is the game (D2)", () => {
    renderBoard();

    expect(screen.queryByTestId("pr-watched-c7")).toBeNull();
  });

  it("draws them when authoring asks (D3)", () => {
    renderBoard({ showWatched: true });

    expect(screen.getByTestId("pr-watched-c7")).toBeInTheDocument();
    // The rook owns the whole b-file, promotion square included.
    expect(screen.getByTestId("pr-watched-b8")).toBeInTheDocument();
  });

  it("stops drawing a dead enemy's zone — the map is LIVE (P2)", async () => {
    // The difference from Safe Path in one assertion. b8 is watched by the rook
    // on b7; eating the rook is what makes b8 safe to stand on.
    renderBoard({ showWatched: true });

    expect(screen.getByTestId("pr-watched-b8")).toBeInTheDocument();

    await step("c6", "b7"); // xb7

    expect(screen.queryByTestId("pr-watched-b8")).toBeNull();
  });

  it("promotes on a square the piece it just ate used to watch", async () => {
    // If the map were computed once per level, this run would end in a grave
    // and the level would be unwinnable.
    const onComplete = vi.fn();
    renderBoard({ onComplete });

    await step("c6", "b7"); // xb7 — the rook stops watching the b-file
    await step("b7", "b8"); // push into what WAS a watched square

    expect(onComplete).toHaveBeenCalledWith(2, 2);
  });

  it("takes the enemy off the board when it is captured", async () => {
    renderBoard();

    await step("c6", "b7");

    expect(screen.queryByTestId("pr-enemy-b7")).toBeNull();
    expect(screen.getByTestId("pr-pawn-b7")).toBeInTheDocument();
  });
});

describe("PromotionRunBoard — the danger", () => {
  it("lets the pawn push INTO a watched square, and catches it there", async () => {
    // Same call as Safe Path: the board does not refuse the move. You can walk
    // there; you must not.
    const onCaught = vi.fn();
    renderBoard({ onCaught });

    await step("c6", "c7");

    expect(onCaught).toHaveBeenCalledWith("c7");
    expect(screen.getByTestId("pr-caught-c7")).toBeInTheDocument();
  });

  it("names the enemy that saw it", async () => {
    renderBoard();

    await step("c6", "c7");

    expect(screen.getByTestId("pr-killer-b7")).toBeInTheDocument();
    expect(screen.getByTestId("pr-beam-b7")).toBeInTheDocument();
  });

  it("stops taking moves once it is caught", async () => {
    const onComplete = vi.fn();
    renderBoard({ onComplete });

    await step("c6", "c7"); // caught
    await step("c7", "c8"); // the last rank is one push away; the run is over

    expect(onComplete).not.toHaveBeenCalled();
  });

  it("sends it back to the START on reset, not to where it died", async () => {
    const { rerender } = renderBoard();

    await step("c6", "c7");

    rerender(
      <NextIntlClientProvider locale="en" messages={messages}>
        <PromotionRunBoard level={LEVEL} resetKey={1} />
      </NextIntlClientProvider>,
    );

    expect(screen.getByTestId("pr-pawn-c6")).toBeInTheDocument();
    expect(screen.queryByTestId("pr-caught-c7")).toBeNull();
  });

  it("brings a captured enemy back on reset — the map resets with it", async () => {
    // The enemies are state now, not props. A reset that forgot them would hand
    // the player a cleared board on their second try.
    const { rerender } = renderBoard();

    await step("c6", "b7");
    expect(screen.queryByTestId("pr-enemy-b7")).toBeNull();

    rerender(
      <NextIntlClientProvider locale="en" messages={messages}>
        <PromotionRunBoard level={LEVEL} resetKey={1} />
      </NextIntlClientProvider>,
    );

    expect(screen.getByTestId("pr-enemy-b7")).toBeInTheDocument();
  });
});

describe("PromotionRunBoard — the pawn's rules", () => {
  it("offers the push and the capture, and nothing else", async () => {
    renderBoard();

    await tap("c6");

    const lit = [...document.querySelectorAll(".playhub-board-cell.is-highlighted")]
      .map((c) => c.closest("[data-square]")?.getAttribute("data-square"))
      .sort();
    // c7 is the push (a grave, but legal), b7 is the capture. d7 is an empty
    // diagonal — the one move that looks legal and never is.
    expect(lit).toEqual(["b7", "c7"]);
  });

  it("never retreats", async () => {
    renderBoard();

    await tap("c6");
    await tap("c5");

    expect(screen.getByTestId("pr-pawn-c6")).toBeInTheDocument();
  });
});

describe("PromotionRunBoard — the select gate", () => {
  it("starts with the pawn NOT picked up", () => {
    renderBoard();

    expect(screen.getByTestId("pr-pawn-c6")).toHaveAttribute(
      "data-selected",
      "false",
    );
  });

  it("shows no destinations until it is picked up", () => {
    renderBoard();

    expect(
      document.querySelectorAll(".playhub-board-cell.is-highlighted"),
    ).toHaveLength(0);
  });

  it("says 'tap your piece first' instead of doing nothing", async () => {
    renderBoard();

    await tap("c7");

    expect(screen.getByTestId("pr-select-hint")).toBeInTheDocument();
    expect(screen.getByTestId("pr-pawn-c6")).toBeInTheDocument();
  });

  it("does not move on a bare destination tap — the gate is the rule", async () => {
    const onCaught = vi.fn();
    renderBoard({ onCaught });

    await tap("c7"); // watched, but it was never picked up

    expect(onCaught).not.toHaveBeenCalled();
    expect(screen.getByTestId("pr-pawn-c6")).toBeInTheDocument();
  });
});
