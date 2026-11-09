import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent } from "@testing-library/react";
import { renderWithIntl as render, screen } from "@/test-utils/render-with-intl";
import { getDailyProgress } from "@/lib/daily/progress";
import { getWelcomePackageState } from "@/lib/welcome-package/storage";
import type { DailyTacticData } from "@/lib/daily/daily-puzzles";

/**
 * Task 10 — THE defect this cluster exists for. One `if` inside
 * `handleSolve` used to grant `firstFocusDayJustEarned` (the
 * `first-focus-day` badge, which stays exactly as-is) AND unlock the
 * Welcome Package gift together. The gift now belongs to the
 * `first-reward` milestone (4 stars AND >=2 exercises, cumulative),
 * derived by the milestone machine — never by the first Daily Focus
 * alone. This file reuses the render conventions of
 * `daily-tactic-sheet.test.tsx` (renderWithIntl + gridcell clicks for
 * the rook a1->h1 solve) and `welcome-package-stamp.test.tsx` /
 * `use-welcome-package.test.ts` (mocking `@/lib/feature-flags` Lite ON
 * + mocking `wagmi`'s `useAccount`/`useSignMessage`).
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

// Pin the puzzle so the solve interaction (a1 -> h1) is deterministic
// regardless of which UTC date the suite runs on. Keep every other
// export (getPuzzleDifficulty, etc. — consumed by daily telemetry)
// wired to the real module.
vi.mock("@/lib/daily/daily-puzzles", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/daily/daily-puzzles")>();
  return {
    ...actual,
    getDailyTactic: () => PUZZLE,
  };
});

const useAccountMock = vi.hoisted(() => vi.fn());
const signMessageAsyncMock = vi.hoisted(() => vi.fn());

vi.mock("wagmi", () => ({
  useAccount: useAccountMock,
  useSignMessage: () => ({ signMessageAsync: signMessageAsyncMock }),
}));

const { DailyTacticSlot } = await import("../daily-tactic-slot");

function getPedestal(): HTMLButtonElement {
  return screen
    .getByTestId("daily-tactic-card")
    .querySelector('[data-component="stone-pedestal"]') as HTMLButtonElement;
}

/** Renders the slot, opens the sheet, and solves the a1->h1 rook puzzle
 *  — driving the component to `handleSolve` exactly like a real first
 *  Daily Focus completion. */
function solveFirstDailyFocus(): void {
  render(<DailyTacticSlot />);
  fireEvent.click(getPedestal());
  fireEvent.click(screen.getByRole("gridcell", { name: "Square a1" }));
  fireEvent.click(screen.getByRole("gridcell", { name: "Square h1" }));
}

beforeEach(() => {
  localStorage.clear();
  useAccountMock.mockReturnValue({ address: undefined, isConnected: false });
  signMessageAsyncMock.mockClear();
});

afterEach(() => {
  cleanup();
});

describe("the gift is no longer bundled with the first Daily Focus", () => {
  it("does not unlock the gift when the first daily tactic is solved", () => {
    solveFirstDailyFocus();

    expect(getDailyProgress().totalCompleted).toBe(1);
    expect(getWelcomePackageState().unlocked).toBe(false);
  });

  it("still marks the solved status and shows the solve screen (regression guard)", () => {
    solveFirstDailyFocus();

    expect(screen.getByTestId("daily-status-solved")).toBeInTheDocument();
  });
});
