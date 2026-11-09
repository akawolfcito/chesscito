import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithIntl as render, screen } from "@/test-utils/render-with-intl";

import { HUB_V2_MASTERY_COPY } from "@/lib/content/editorial";
import type { PieceId } from "@/lib/game/types";

/** Phase 5 commit 1 — <MasteryDashboard> grid + telemetry + ARIA + streak.
 *  Design-lock §1.3 + §2.2 + §5 + §9.3.
 *
 *  6 asserts (5 per spec + 1 streak header per session decision):
 *    1. Grid renders 6 tiles in canonical order R B N P Q K
 *    2. Q tile renders with data-state=locked-buildable; K with data-state=coming-soon
 *    3. Tap on buildable tile fires hub_v2_mastery_tap with payload
 *    4. Tap on Q tile fires hub_v2_mastery_tap; K tile fires hub_v2_mastery_locked_tap
 *    5. Each tile has aria-label per HUB_V2_MASTERY_COPY[piece].ariaLabel(state, ...)
 *    6. Streak header renders streakLabel(days); absent when days=0 */

const trackMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/telemetry", () => ({
  track: (...args: unknown[]) => trackMock(...args),
}));

import { MasteryDashboard } from "../mastery-dashboard";

const CANONICAL_ORDER: PieceId[] = [
  "rook",
  "bishop",
  "knight",
  "pawn",
  "queen",
  "king",
];

function buildTiles(): Parameters<typeof MasteryDashboard>[0]["tiles"] {
  return {
    rook: { state: "mastered", starsEarned: 3, starsTotal: 3 },
    bishop: { state: "in-progress", starsEarned: 2, starsTotal: 3 },
    knight: { state: "in-progress", starsEarned: 1, starsTotal: 3 },
    pawn: { state: "locked-buildable", starsEarned: 0, starsTotal: 3 },
    queen: { state: "locked-buildable", starsEarned: 0, starsTotal: 3 },
    king: { state: "coming-soon", starsEarned: 0, starsTotal: 3 },
  };
}

beforeEach(() => {
  trackMock.mockReset();
});

afterEach(() => {
  cleanup();
});

describe("<MasteryDashboard> — grid + telemetry + ARIA + streak", () => {
  it("(1) renders 6 tiles in canonical order R B N P Q K", () => {
    const { container } = render(
      <MasteryDashboard
        tiles={buildTiles()}
        streakDays={4}
        onTileTap={vi.fn()}
      />,
    );

    const tiles = container.querySelectorAll('[data-component="mastery-tile"]');
    expect(tiles).toHaveLength(6);

    const order = Array.from(tiles).map((t) => t.getAttribute("data-piece"));
    expect(order).toEqual(CANONICAL_ORDER);
  });

  it("(2) Q tile renders with data-state=locked-buildable; K with data-state=coming-soon", () => {
    const { container } = render(
      <MasteryDashboard
        tiles={buildTiles()}
        streakDays={4}
        onTileTap={vi.fn()}
      />,
    );

    const queen = container.querySelector(
      '[data-component="mastery-tile"][data-piece="queen"]',
    );
    const king = container.querySelector(
      '[data-component="mastery-tile"][data-piece="king"]',
    );

    expect(queen?.getAttribute("data-state")).toBe("locked-buildable");
    expect(king?.getAttribute("data-state")).toBe("coming-soon");
  });

  it("(3) tap on buildable tile fires hub_v2_mastery_tap with { piece, state, starsEarned }", async () => {
    const onTileTap = vi.fn();
    const user = userEvent.setup();
    const { container } = render(
      <MasteryDashboard
        tiles={buildTiles()}
        streakDays={4}
        onTileTap={onTileTap}
      />,
    );

    const bishop = container.querySelector(
      '[data-component="mastery-tile"][data-piece="bishop"]',
    ) as HTMLElement;
    await user.click(bishop);

    const tapCall = trackMock.mock.calls.find(
      (call) => call[0] === "hub_v2_mastery_tap",
    );
    expect(tapCall).toBeDefined();
    expect(tapCall?.[1]).toMatchObject({
      piece: "bishop",
      state: "in-progress",
      starsEarned: 2,
    });

    expect(onTileTap).toHaveBeenCalledWith("bishop", "in-progress", 2);
  });

  it("(4) tap on Q tile fires hub_v2_mastery_tap; K tile fires hub_v2_mastery_locked_tap", async () => {
    const onTileTap = vi.fn();
    const user = userEvent.setup();
    const { container } = render(
      <MasteryDashboard
        tiles={buildTiles()}
        streakDays={4}
        onTileTap={onTileTap}
      />,
    );

    const queen = container.querySelector(
      '[data-component="mastery-tile"][data-piece="queen"]',
    ) as HTMLElement;
    await user.click(queen);

    const tapCall = trackMock.mock.calls.find(
      (call) => call[0] === "hub_v2_mastery_tap",
    );
    expect(tapCall).toBeDefined();
    expect(tapCall?.[1]).toMatchObject({
      piece: "queen",
      state: "locked-buildable",
      starsEarned: 0,
    });

    expect(onTileTap).toHaveBeenCalledWith("queen", "locked-buildable", 0);

    trackMock.mockClear();
    onTileTap.mockClear();

    const king = container.querySelector(
      '[data-component="mastery-tile"][data-piece="king"]',
    ) as HTMLElement;
    await user.click(king);

    const lockedCall = trackMock.mock.calls.find(
      (call) => call[0] === "hub_v2_mastery_locked_tap",
    );
    expect(lockedCall).toBeDefined();
    expect(lockedCall?.[1]).toMatchObject({ piece: "king" });

    const tapCall2 = trackMock.mock.calls.find(
      (call) => call[0] === "hub_v2_mastery_tap",
    );
    expect(tapCall2).toBeUndefined();

    expect(onTileTap).toHaveBeenCalledWith("king", "coming-soon", 0);
  });

  it("(5) each tile has aria-label per HUB_V2_MASTERY_COPY[piece].ariaLabel(state, ...)", () => {
    const tiles = buildTiles();
    const { container } = render(
      <MasteryDashboard tiles={tiles} streakDays={4} onTileTap={vi.fn()} />,
    );

    for (const piece of CANONICAL_ORDER) {
      const tile = container.querySelector(
        `[data-component="mastery-tile"][data-piece="${piece}"]`,
      );
      const data = tiles[piece];
      const expected = HUB_V2_MASTERY_COPY[piece].ariaLabel(
        data.state,
        data.starsEarned,
        data.starsTotal,
      );
      expect(tile?.getAttribute("aria-label")).toBe(expected);
    }
  });

  it("(6) streak header: renders streakLabel(days) when days > 0; absent when days = 0", () => {
    const { rerender } = render(
      <MasteryDashboard
        tiles={buildTiles()}
        streakDays={4}
        onTileTap={vi.fn()}
      />,
    );

    const streak = screen.getByTestId("mastery-streak");
    expect(streak.textContent).toBe(HUB_V2_MASTERY_COPY.streakLabel(4));
    expect(streak.textContent).toBe("4-day streak");

    rerender(
      <MasteryDashboard
        tiles={buildTiles()}
        streakDays={1}
        onTileTap={vi.fn()}
      />,
    );
    expect(screen.getByTestId("mastery-streak").textContent).toBe(
      "1-day streak",
    );

    rerender(
      <MasteryDashboard
        tiles={buildTiles()}
        streakDays={0}
        onTileTap={vi.fn()}
      />,
    );
    expect(screen.queryByTestId("mastery-streak")).not.toBeInTheDocument();
  });

  it("(7) dashboard root has aria-label = HUB_V2_MASTERY_COPY.masteryDashboardAriaLabel", () => {
    const { container } = render(
      <MasteryDashboard
        tiles={buildTiles()}
        streakDays={4}
        onTileTap={vi.fn()}
      />,
    );
    const root = container.querySelector(
      '[data-component="mastery-dashboard"]',
    );
    expect(root?.getAttribute("aria-label")).toBe(
      HUB_V2_MASTERY_COPY.masteryDashboardAriaLabel,
    );
  });
});
