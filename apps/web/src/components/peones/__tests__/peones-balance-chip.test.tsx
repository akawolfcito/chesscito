/**
 * Tests for PeonesBalanceChip — Sprint 3 commit G of Training
 * Economy Alpha (2026-06-07). Mocks the underlying hook so the chip
 * is exercised over its four render states (guest / loading /
 * success / error) without firing /api/peones/balance.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

const usePeonesBalanceMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/peones/use-peones-balance", () => ({
  usePeonesBalance: usePeonesBalanceMock,
}));

const trackMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/telemetry", () => ({
  track: trackMock,
}));

// Stub the GetPeonesSheet so the chip test stays isolated from the rail
// hooks (wagmi/verify). The stub renders a marker only when open.
vi.mock("@/components/payments/get-peones-sheet", () => ({
  GetPeonesSheet: ({ open }: { open: boolean }) =>
    open ? <div data-testid="get-peones-sheet-stub">sheet</div> : null,
}));

import { PeonesBalanceChip } from "@/components/peones/peones-balance-chip";

beforeEach(() => {
  trackMock.mockClear();
});

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
    expect(chip).toHaveAttribute("aria-label", "Get Peones. Balance: 12");
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

describe("PeonesBalanceChip — peones_balance_viewed telemetry (Sprint 3 commit H)", () => {
  it("emits once on success with the balance + surface=hub by default", () => {
    usePeonesBalanceMock.mockReturnValue({
      state: {
        kind: "success",
        balance: 7,
        dailyEarnedCapped: 3,
        dailyCap: 10,
        lastEventAt: null,
      },
      refetch: vi.fn(),
    });
    render(<PeonesBalanceChip />);
    expect(trackMock).toHaveBeenCalledWith("peones_balance_viewed", {
      balance: 7,
      dailyEarnedCapped: 3,
      dailyCap: 10,
      surface: "hub",
    });
    expect(
      trackMock.mock.calls.filter((c) => c[0] === "peones_balance_viewed"),
    ).toHaveLength(1);
  });

  it("does NOT emit for guest / loading / error states", () => {
    usePeonesBalanceMock.mockReturnValue({ state: { kind: "guest" }, refetch: vi.fn() });
    render(<PeonesBalanceChip />);
    expect(trackMock).not.toHaveBeenCalled();

    usePeonesBalanceMock.mockReturnValue({ state: { kind: "loading" }, refetch: vi.fn() });
    render(<PeonesBalanceChip />);
    expect(trackMock).not.toHaveBeenCalled();

    usePeonesBalanceMock.mockReturnValue({ state: { kind: "error" }, refetch: vi.fn() });
    render(<PeonesBalanceChip />);
    expect(trackMock).not.toHaveBeenCalled();
  });

  it("supports a custom surface prop (future cluster mount)", () => {
    usePeonesBalanceMock.mockReturnValue({
      state: {
        kind: "success",
        balance: 7,
        dailyEarnedCapped: 3,
        dailyCap: 10,
        lastEventAt: null,
      },
      refetch: vi.fn(),
    });
    render(<PeonesBalanceChip surface="arena" />);
    expect(trackMock).toHaveBeenCalledWith(
      "peones_balance_viewed",
      expect.objectContaining({ surface: "arena" }),
    );
  });
});

describe("PeonesBalanceChip — Get Peones entry point (payment rail)", () => {
  function successState() {
    usePeonesBalanceMock.mockReturnValue({
      state: { kind: "success", balance: 12, dailyEarnedCapped: 6, dailyCap: 10, lastEventAt: null },
      refetch: vi.fn(),
    });
  }

  it("does not show the sheet until the chip is tapped", () => {
    successState();
    render(<PeonesBalanceChip />);
    expect(screen.queryByTestId("get-peones-sheet-stub")).not.toBeInTheDocument();
  });

  it("tapping the chip opens the GetPeonesSheet", () => {
    successState();
    render(<PeonesBalanceChip />);
    fireEvent.click(screen.getByTestId("peones-balance-chip"));
    expect(screen.getByTestId("get-peones-sheet-stub")).toBeInTheDocument();
  });

  it("Enter / Space on the chip opens the sheet (keyboard)", () => {
    successState();
    render(<PeonesBalanceChip />);
    fireEvent.keyDown(screen.getByTestId("peones-balance-chip"), { key: "Enter" });
    expect(screen.getByTestId("get-peones-sheet-stub")).toBeInTheDocument();
  });

  it("the chip is reachable as a button and shows no spend action", () => {
    successState();
    render(<PeonesBalanceChip />);
    const chip = screen.getByTestId("peones-balance-chip");
    expect(chip).toHaveAttribute("role", "button");
    expect(screen.queryByRole("button", { name: /spend/i })).not.toBeInTheDocument();
  });

  it("guest never gets an entry point (chip hidden → no sheet)", () => {
    usePeonesBalanceMock.mockReturnValue({ state: { kind: "guest" }, refetch: vi.fn() });
    render(<PeonesBalanceChip />);
    expect(screen.queryByTestId("peones-balance-chip")).not.toBeInTheDocument();
    expect(screen.queryByTestId("get-peones-sheet-stub")).not.toBeInTheDocument();
  });
});
