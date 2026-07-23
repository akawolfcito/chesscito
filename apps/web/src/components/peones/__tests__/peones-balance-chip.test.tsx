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
    expect(chip).toHaveTextContent("…");
  });
});

describe("PeonesBalanceChip — success", () => {
  it("renders the balance count, number only (visual-first)", () => {
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
    expect(chip).toHaveTextContent("12");
    expect(chip).toHaveAttribute("aria-label", "Get Peones. Balance: 12");
  });

  it("renders balance=0 as '0' (not hidden)", () => {
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
      "0",
    );
  });
});

describe("PeonesBalanceChip — error (non-aggressive fallback)", () => {
  it("renders '--' without any banner or modal", () => {
    usePeonesBalanceMock.mockReturnValue({
      state: { kind: "error" },
      refetch: vi.fn(),
    });

    render(<PeonesBalanceChip />);
    const chip = screen.getByTestId("peones-balance-chip");
    expect(chip).toHaveAttribute("data-state", "error");
    expect(chip).toHaveTextContent("--");
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

  it("does not show the card until the chip is tapped", () => {
    successState();
    render(<PeonesBalanceChip />);
    expect(screen.queryByTestId("chesito-card")).not.toBeInTheDocument();
  });

  it("tapping the chip opens the Chesito Card", () => {
    successState();
    render(<PeonesBalanceChip />);
    fireEvent.click(screen.getByTestId("peones-balance-chip"));
    expect(screen.getByTestId("chesito-card")).toBeInTheDocument();
  });

  it("Enter / Space on the chip opens the card (keyboard)", () => {
    successState();
    render(<PeonesBalanceChip />);
    fireEvent.keyDown(screen.getByTestId("peones-balance-chip"), { key: "Enter" });
    expect(screen.getByTestId("chesito-card")).toBeInTheDocument();
  });

  it("portals the card to <body> so a stacking-context ancestor can't trap it", () => {
    // Regression 2026-07-22: on /exercises the chip lives inside
    // `.atmosphere > * { position:relative; z-index:1 }` (the mission tray).
    // A fixed modal rendered in-tree is painted WITHIN that child's stacking
    // context, so the board — a later sibling with the same z-index — covers
    // it despite the modal's z-[70]. Portaling to <body> escapes it.
    successState();
    const { container } = render(<PeonesBalanceChip />);
    fireEvent.click(screen.getByTestId("peones-balance-chip"));
    const dialog = screen.getByRole("dialog");
    expect(container).not.toContainElement(dialog);
    expect(dialog.parentElement).toBe(document.body);
  });

  it("the chip is reachable as a button and shows no spend action", () => {
    successState();
    render(<PeonesBalanceChip />);
    const chip = screen.getByTestId("peones-balance-chip");
    expect(chip).toHaveAttribute("role", "button");
    expect(screen.queryByRole("button", { name: /spend/i })).not.toBeInTheDocument();
  });

  it("guest never gets an entry point (chip hidden → no card)", () => {
    usePeonesBalanceMock.mockReturnValue({ state: { kind: "guest" }, refetch: vi.fn() });
    render(<PeonesBalanceChip />);
    expect(screen.queryByTestId("peones-balance-chip")).not.toBeInTheDocument();
    expect(screen.queryByTestId("chesito-card")).not.toBeInTheDocument();
  });
});
