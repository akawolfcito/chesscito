/**
 * The balance is visible where it is SPENT — /exercises, in the quest
 * tray above the board (Peones V1 UX, 2026-07-21).
 *
 * Exercises the chip through `PeonesBalanceChipView`, the prop-fed half
 * of the component. That is the same seam the /dev probes use: the
 * connected `PeonesBalanceChip` reads wagmi's `useAccount`, which throws
 * without a WagmiProvider, and mounting the whole exercises screen to
 * assert one chip would test the screen, not the requirement.
 *
 * What the requirement actually is:
 *   - a connected player sees the number while playing
 *   - it re-reads on the balance-change bus, so an earn/spend moves it
 *     without leaving for the Hub
 *   - a guest sees nothing (no balance is invented for a wallet-less
 *     player)
 */

import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@/lib/peones/telemetry", () => ({
  emitPeonesBalanceViewed: vi.fn(),
}));

import { PeonesBalanceChipView } from "@/components/peones/peones-balance-chip";

describe("Peones balance on /exercises", () => {
  it("shows the balance while the player is on the exercises surface", () => {
    render(
      <PeonesBalanceChipView
        surface="exercises"
        state={{
          kind: "success",
          balance: 12,
          dailyEarnedCapped: 0,
          dailyCap: 10,
          lastEventAt: null,
        }}
        onRefetch={() => {}}
      />,
    );

    const chip = screen.getByTestId("peones-balance-chip");
    expect(chip).toHaveTextContent("12");
    expect(chip).toHaveAttribute("data-state", "success");
  });

  it("reflects a debited balance — the number is told, never derived locally", () => {
    const { rerender } = render(
      <PeonesBalanceChipView
        surface="exercises"
        state={{
          kind: "success",
          balance: 12,
          dailyEarnedCapped: 0,
          dailyCap: 10,
          lastEventAt: null,
        }}
        onRefetch={() => {}}
      />,
    );
    expect(screen.getByTestId("peones-balance-chip")).toHaveTextContent("12");

    // A hint spend debits 2; the server is re-read and hands down 10.
    rerender(
      <PeonesBalanceChipView
        surface="exercises"
        state={{
          kind: "success",
          balance: 10,
          dailyEarnedCapped: 0,
          dailyCap: 10,
          lastEventAt: null,
        }}
        onRefetch={() => {}}
      />,
    );

    expect(screen.getByTestId("peones-balance-chip")).toHaveTextContent("10");
  });

  it("renders nothing for a guest — no balance is invented without a wallet", () => {
    const { container } = render(
      <PeonesBalanceChipView
        surface="exercises"
        state={{ kind: "guest" }}
        onRefetch={() => {}}
      />,
    );

    expect(container.firstChild).toBeNull();
  });

  it("degrades quietly when the balance cannot be read", () => {
    render(
      <PeonesBalanceChipView
        surface="exercises"
        state={{ kind: "error" }}
        onRefetch={() => {}}
      />,
    );

    // Discrete fallback, never an error banner over the board.
    const chip = screen.getByTestId("peones-balance-chip");
    expect(chip).toHaveTextContent("--");
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
