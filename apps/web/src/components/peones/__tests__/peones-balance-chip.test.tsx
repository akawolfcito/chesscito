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
import { resetPeonesBalanceViewDedup } from "@/lib/peones/telemetry";

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

/**
 * Telemetry de-amplification, 2026-08-18.
 *
 * Measured in production over 24 h: 596 `peones_balance_viewed` rows collapsed
 * to 305 distinct (session, surface, balance) combinations — **48.8% of the
 * event was re-emission of a balance the same session had already seen on the
 * same surface**. Arena was the worst at 3.0×, which is what a chip that
 * remounts on every state transition looks like.
 *
 * ⛔ The old guard was per COMPONENT INSTANCE (`lastEmittedBalanceRef`), so a
 * remount re-emitted an unchanged balance. The guard has to outlive the
 * component, and it must stay keyed by SURFACE — "where the player sees their
 * balance" is the product signal, and collapsing surfaces would destroy it.
 *
 * Semantics after this change: *the balance became visible to this session on
 * this surface, for the first time at this value.*
 */
describe("peones_balance_viewed — de-amplification", () => {
  // The dedup set is module state: without this the cases would leak into one
  // another and a green run could depend on the order they happened to run in.
  beforeEach(() => resetPeonesBalanceViewDedup());

  const viewedCalls = () =>
    trackMock.mock.calls.filter((c) => c[0] === "peones_balance_viewed");

  const success = (balance: number) => ({
    state: {
      kind: "success" as const,
      balance,
      dailyEarnedCapped: 0,
      dailyCap: 30,
    },
    refetch: vi.fn(),
  });

  it("emits on the first render of a balance", () => {
    usePeonesBalanceMock.mockReturnValue(success(12));
    render(<PeonesBalanceChip surface="hub" />);
    expect(viewedCalls()).toHaveLength(1);
  });

  it("⛔ does NOT re-emit after a REMOUNT with the same balance", () => {
    // The exact production failure: 3.0× amplification on the Arena surface.
    usePeonesBalanceMock.mockReturnValue(success(12));
    const first = render(<PeonesBalanceChip surface="arena" />);
    first.unmount();
    render(<PeonesBalanceChip surface="arena" />);
    expect(viewedCalls()).toHaveLength(1);
  });

  it("does not re-emit on a plain rerender either", () => {
    usePeonesBalanceMock.mockReturnValue(success(12));
    const view = render(<PeonesBalanceChip surface="hub" />);
    view.rerender(<PeonesBalanceChip surface="hub" />);
    expect(viewedCalls()).toHaveLength(1);
  });

  it("DOES emit again when the balance actually changes", () => {
    usePeonesBalanceMock.mockReturnValue(success(12));
    const view = render(<PeonesBalanceChip surface="hub" />);
    usePeonesBalanceMock.mockReturnValue(success(18));
    view.rerender(<PeonesBalanceChip surface="hub" />);
    expect(viewedCalls()).toHaveLength(2);
  });

  it("DOES emit per SURFACE — where the balance is seen is the product signal", () => {
    usePeonesBalanceMock.mockReturnValue(success(12));
    render(<PeonesBalanceChip surface="hub" />);
    cleanup();
    render(<PeonesBalanceChip surface="arena" />);
    const surfaces = viewedCalls().map((c) => (c[1] as { surface: string }).surface);
    expect(surfaces).toEqual(["hub", "arena"]);
  });

  it("keeps the full payload — de-amplifying must not thin the event", () => {
    usePeonesBalanceMock.mockReturnValue(success(12));
    render(<PeonesBalanceChip surface="hub" />);
    expect(viewedCalls()[0]?.[1]).toEqual({
      balance: 12,
      dailyEarnedCapped: 0,
      dailyCap: 30,
      surface: "hub",
    });
  });

  it("never emits while loading or on error", () => {
    usePeonesBalanceMock.mockReturnValue({ state: { kind: "loading" as const }, refetch: vi.fn() });
    render(<PeonesBalanceChip surface="hub" />);
    cleanup();
    usePeonesBalanceMock.mockReturnValue({ state: { kind: "error" as const }, refetch: vi.fn() });
    render(<PeonesBalanceChip surface="hub" />);
    expect(viewedCalls()).toHaveLength(0);
  });
});
