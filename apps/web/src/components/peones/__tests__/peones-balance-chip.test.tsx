/**
 * Tests for PeonesBalanceChip — Sprint 3 commit G of Training
 * Economy Alpha (2026-06-07). Mocks the underlying hook so the chip
 * is exercised over its four render states (guest / loading /
 * success / error) without firing /api/peones/balance.
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

const usePeonesBalanceMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/peones/use-peones-balance", () => ({
  usePeonesBalance: usePeonesBalanceMock,
}));

import { PeonesBalanceChip } from "@/components/peones/peones-balance-chip";

afterEach(() => {
  usePeonesBalanceMock.mockReset();
  cleanup();
});

describe("PeonesBalanceChip — guest", () => {
  it("renders null (chip hidden) when state.kind === 'guest'", () => {
    usePeonesBalanceMock.mockReturnValue({
      state: { kind: "guest" },
      refetch: vi.fn(),
    });

    render(<PeonesBalanceChip />);
    expect(screen.queryByTestId("peones-balance-chip")).not.toBeInTheDocument();
  });
});

describe("PeonesBalanceChip — loading", () => {
  it("renders the chip with the discrete loading dots", () => {
    usePeonesBalanceMock.mockReturnValue({
      state: { kind: "loading" },
      refetch: vi.fn(),
    });

    render(<PeonesBalanceChip />);
    const chip = screen.getByTestId("peones-balance-chip");
    expect(chip).toBeInTheDocument();
    expect(chip).toHaveAttribute("data-state", "loading");
    expect(chip).toHaveTextContent("Peones …");
  });
});

describe("PeonesBalanceChip — success", () => {
  it("renders the balance count followed by 'Peones'", () => {
    usePeonesBalanceMock.mockReturnValue({
      state: {
        kind: "success",
        balance: 12,
        dailyEarnedCapped: 6,
        dailyCap: 10,
        lastEventAt: "2026-06-07T10:00:00Z",
      },
      refetch: vi.fn(),
    });

    render(<PeonesBalanceChip />);
    const chip = screen.getByTestId("peones-balance-chip");
    expect(chip).toHaveAttribute("data-state", "success");
    expect(chip).toHaveTextContent("12 Peones");
    expect(chip).toHaveAttribute("aria-label", "Peones balance: 12");
  });

  it("renders balance=0 as '0 Peones' (not hidden)", () => {
    usePeonesBalanceMock.mockReturnValue({
      state: {
        kind: "success",
        balance: 0,
        dailyEarnedCapped: 0,
        dailyCap: 10,
        lastEventAt: null,
      },
      refetch: vi.fn(),
    });

    render(<PeonesBalanceChip />);
    expect(screen.getByTestId("peones-balance-chip")).toHaveTextContent(
      "0 Peones",
    );
  });
});

describe("PeonesBalanceChip — error (non-aggressive fallback)", () => {
  it("renders 'Peones --' without any banner or modal", () => {
    usePeonesBalanceMock.mockReturnValue({
      state: { kind: "error" },
      refetch: vi.fn(),
    });

    render(<PeonesBalanceChip />);
    const chip = screen.getByTestId("peones-balance-chip");
    expect(chip).toHaveAttribute("data-state", "error");
    expect(chip).toHaveTextContent("Peones --");
    // No alert / banner / modal element appears.
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});

describe("PeonesBalanceChip — read-only contract (no spend/top-up)", () => {
  it("renders NO spend, top-up, or top-up buttons in any state", () => {
    usePeonesBalanceMock.mockReturnValue({
      state: {
        kind: "success",
        balance: 12,
        dailyEarnedCapped: 6,
        dailyCap: 10,
        lastEventAt: null,
      },
      refetch: vi.fn(),
    });

    render(<PeonesBalanceChip />);
    expect(screen.queryByRole("button", { name: /spend/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /top.?up/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /buy/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /purchase/i })).not.toBeInTheDocument();
  });
});
