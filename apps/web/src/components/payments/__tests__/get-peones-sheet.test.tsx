import { describe, expect, it, vi } from "vitest";
import { fireEvent } from "@testing-library/react";
import { renderWithIntl as render, screen } from "@/test-utils/render-with-intl";

vi.mock("@/lib/payments/use-payment-rail", () => ({ usePaymentRail: vi.fn() }));
vi.mock("@/lib/payments/use-get-peones-token-selection", () => ({
  useGetPeonesTokenSelection: vi.fn(),
}));

import { GetPeonesSheet } from "@/components/payments/get-peones-sheet";
import { usePaymentRail } from "@/lib/payments/use-payment-rail";
import { useGetPeonesTokenSelection } from "@/lib/payments/use-get-peones-token-selection";

const mockedRail = vi.mocked(usePaymentRail);
const mockedSel = vi.mocked(useGetPeonesTokenSelection);
const HASH = `0x${"a".repeat(64)}`;

type RailReturn = ReturnType<typeof usePaymentRail>;
type SelReturn = ReturnType<typeof useGetPeonesTokenSelection>;

function railState(over: Partial<RailReturn> = {}): RailReturn {
  return {
    available: true,
    unavailableReason: null,
    phase: "idle",
    txHash: null,
    result: null,
    errorReason: null,
    pay: vi.fn(),
    verifyAgain: vi.fn(),
    reset: vi.fn(),
    ...over,
  } as RailReturn;
}

const usdt = { symbol: "USDT", address: "0x", decimals: 6, balance: 300_000_000n, expectedAmount: 500_000n, payable: true };
const usdcLow = { symbol: "USDC", address: "0x", decimals: 6, balance: 0n, expectedAmount: 500_000n, payable: false };

function selState(over: Partial<SelReturn> = {}): SelReturn {
  return {
    loading: false,
    tokens: [usdcLow, usdt],
    selectedSymbol: "USDT",
    setSelectedSymbol: vi.fn(),
    selected: usdt,
    noPayableToken: false,
    ...over,
  } as SelReturn;
}

function renderSheet(props: Partial<Parameters<typeof GetPeonesSheet>[0]> = {}) {
  return render(<GetPeonesSheet open onOpenChange={vi.fn()} {...props} />);
}

describe("GetPeonesSheet", () => {
  it("opens on the default amount (25 Peones) and its price ($0.25)", () => {
    mockedRail.mockReturnValue(railState());
    mockedSel.mockReturnValue(selState());
    renderSheet();
    expect(screen.getByText("25 Peones")).toBeInTheDocument();
    expect(screen.getAllByText("$0.25").length).toBeGreaterThan(0);
  });

  it("trigger shows the auto-selected token; opening reveals aria-selected options", () => {
    mockedRail.mockReturnValue(railState());
    mockedSel.mockReturnValue(selState());
    renderSheet();
    // Collapsed: the trigger surfaces the selected token + the pay label.
    expect(screen.getByTestId("get-peones-token-trigger")).toHaveTextContent("USDT");
    expect(screen.getByTestId("get-peones-pay")).toHaveTextContent("Pay $0.25");
    // Options only exist once the dropdown is open.
    expect(screen.queryByTestId("get-peones-token-USDC")).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId("get-peones-token-trigger"));
    expect(screen.getByTestId("get-peones-token-USDT")).toHaveAttribute("aria-selected", "true");
    expect(screen.getByTestId("get-peones-token-USDC")).toHaveAttribute("aria-selected", "false");
  });

  it("tapping a token option calls setSelectedSymbol", () => {
    const setSelectedSymbol = vi.fn();
    mockedRail.mockReturnValue(railState());
    mockedSel.mockReturnValue(selState({ setSelectedSymbol }));
    renderSheet();
    fireEvent.click(screen.getByTestId("get-peones-token-trigger")); // open dropdown
    fireEvent.click(screen.getByTestId("get-peones-token-USDC"));
    expect(setSelectedSymbol).toHaveBeenCalledWith("USDC");
  });

  it("the pay button calls pay()", () => {
    const pay = vi.fn();
    mockedRail.mockReturnValue(railState({ pay }));
    mockedSel.mockReturnValue(selState());
    renderSheet();
    fireEvent.click(screen.getByTestId("get-peones-pay"));
    expect(pay).toHaveBeenCalledTimes(1);
  });

  it("rail unavailable → no pay button, shows the reason", () => {
    mockedRail.mockReturnValue(railState({ available: false, unavailableReason: "wrong_chain" }));
    mockedSel.mockReturnValue(selState());
    renderSheet();
    expect(screen.queryByTestId("get-peones-pay")).not.toBeInTheDocument();
    expect(screen.getByText(/Switch your wallet to Celo/i)).toBeInTheDocument();
  });

  it("no payable token → insufficient state, no pay button", () => {
    mockedRail.mockReturnValue(railState());
    mockedSel.mockReturnValue(selState({ noPayableToken: true, selectedSymbol: null, selected: null }));
    renderSheet();
    expect(screen.queryByTestId("get-peones-pay")).not.toBeInTheDocument();
    expect(screen.getByTestId("get-peones-insufficient")).toBeInTheDocument();
  });

  it("selected token not payable (manual override) → pay disabled + low-balance hint", () => {
    mockedRail.mockReturnValue(railState());
    mockedSel.mockReturnValue(selState({ selectedSymbol: "USDC", selected: usdcLow }));
    renderSheet();
    expect(screen.getByTestId("get-peones-pay")).toBeDisabled();
    expect(screen.getByTestId("get-peones-token-low")).toHaveTextContent("Not enough USDC balance");
  });

  it("loading state disables the button and changes the copy", () => {
    mockedRail.mockReturnValue(railState({ phase: "awaiting_signature" }));
    mockedSel.mockReturnValue(selState());
    renderSheet();
    const btn = screen.getByTestId("get-peones-pay");
    expect(btn).toBeDisabled();
    expect(btn).toHaveTextContent("Confirm in your wallet");
  });

  it("success shows +50 Peones credited", () => {
    mockedRail.mockReturnValue(
      railState({ phase: "success", result: { txHash: HASH, duplicate: false, peonesCredited: 50, token: "0x", amountPaid: "500000", overpaid: false } }),
    );
    mockedSel.mockReturnValue(selState());
    renderSheet();
    expect(screen.getByText("+50 Peones credited")).toBeInTheDocument();
  });

  it("duplicate:true is shown as success (no double charge)", () => {
    mockedRail.mockReturnValue(
      railState({ phase: "success", result: { txHash: HASH, duplicate: true, peonesCredited: 50, token: "0x", amountPaid: "500000", overpaid: false } }),
    );
    mockedSel.mockReturnValue(selState());
    renderSheet();
    expect(screen.getByText("+50 Peones credited")).toBeInTheDocument();
    expect(screen.getByText(/no double charge/i)).toBeInTheDocument();
  });

  it("verify failure with a txHash shows Verify again → calls verifyAgain()", () => {
    const verifyAgain = vi.fn();
    mockedRail.mockReturnValue(railState({ phase: "error", errorReason: "amount_too_low", txHash: HASH as `0x${string}`, verifyAgain }));
    mockedSel.mockReturnValue(selState());
    renderSheet();
    // CRITICAL (UX audit): the raw rail errorReason must NEVER reach the user.
    expect(screen.queryByText(/amount_too_low/)).not.toBeInTheDocument();
    expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("get-peones-verify-again"));
    expect(verifyAgain).toHaveBeenCalledTimes(1);
  });

  it("user_rejected shows a friendly cancelled message, no raw reason, no verify", () => {
    mockedRail.mockReturnValue(railState({ phase: "error", errorReason: "user_rejected", txHash: null }));
    mockedSel.mockReturnValue(selState());
    renderSheet();
    expect(screen.getByText(/cancelled/i)).toBeInTheDocument();
    expect(screen.queryByText(/user_rejected/)).not.toBeInTheDocument();
    expect(screen.queryByTestId("get-peones-verify-again")).not.toBeInTheDocument();
  });

  it("unknown canary submission state does not invite another payment", () => {
    mockedRail.mockReturnValue(railState({
      phase: "error",
      errorReason: "unknown_submission_state",
      paymentRetryBlocked: true,
    }));
    mockedSel.mockReturnValue(selState());
    renderSheet();
    expect(screen.getByTestId("get-peones-pay")).toBeDisabled();
    expect(screen.queryByTestId("get-peones-verify-again")).not.toBeInTheDocument();
  });

  it("passes onSuccess to usePaymentRail as onVerified", () => {
    const onSuccess = vi.fn();
    mockedRail.mockReturnValue(railState());
    mockedSel.mockReturnValue(selState());
    renderSheet({ onSuccess });
    expect(mockedRail).toHaveBeenCalledWith(
      expect.objectContaining({ sku: "peones_pack_25", tokenSymbol: "USDT", onVerified: onSuccess }),
    );
  });

  it("never shows the technical no-approve line nor an approve action", () => {
    mockedRail.mockReturnValue(railState());
    mockedSel.mockReturnValue(selState());
    renderSheet();
    // The "1 transaction, no approve" microcopy was removed (founder call);
    // the single-tx rail must still never expose an approve action.
    expect(screen.queryByText(/no approve/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^approve$/i })).not.toBeInTheDocument();
  });
});

describe("GetPeonesSheet — flexible amount stepper", () => {
  const stepper = () => screen.getByTestId("get-peones-stepper");
  const minus = () => screen.getByTestId("get-peones-decrease");
  const plus = () => screen.getByTestId("get-peones-increase");

  function open(props: Partial<Parameters<typeof GetPeonesSheet>[0]> = {}) {
    mockedRail.mockReturnValue(railState());
    mockedSel.mockReturnValue(selState());
    return renderSheet(props);
  }

  it("labels the controls by what they change, not by their glyph", () => {
    open();
    expect(screen.getByLabelText("Decrease Peones")).toBe(minus());
    expect(screen.getByLabelText("Increase Peones")).toBe(plus());
  });

  it("steps up and down by 5, moving reward and price together", () => {
    open();
    expect(stepper()).toHaveAttribute("data-amount", "25");
    fireEvent.click(plus());
    expect(stepper()).toHaveAttribute("data-amount", "30");
    expect(screen.getByText("30 Peones")).toBeInTheDocument();
    expect(screen.getByTestId("get-peones-price")).toHaveTextContent("$0.30");
    fireEvent.click(minus());
    fireEvent.click(minus());
    expect(stepper()).toHaveAttribute("data-amount", "20");
    expect(screen.getByText("20 Peones")).toBeInTheDocument();
    expect(screen.getByTestId("get-peones-price")).toHaveTextContent("$0.20");
  });

  it("stops at 5 and at 100 instead of running off the ladder", () => {
    open();
    for (let i = 0; i < 10; i += 1) fireEvent.click(minus());
    expect(stepper()).toHaveAttribute("data-amount", "5");
    expect(minus()).toBeDisabled();
    for (let i = 0; i < 30; i += 1) fireEvent.click(plus());
    expect(stepper()).toHaveAttribute("data-amount", "100");
    expect(plus()).toBeDisabled();
    expect(screen.getByTestId("get-peones-price")).toHaveTextContent("$1.00");
  });

  it("buys the SKU that matches the amount on screen", () => {
    open();
    fireEvent.click(plus());
    fireEvent.click(plus());
    expect(mockedRail).toHaveBeenLastCalledWith(
      expect.objectContaining({ sku: "peones_pack_35" }),
    );
  });

  it("honours initialAmount", () => {
    open({ initialAmount: 60 });
    expect(stepper()).toHaveAttribute("data-amount", "60");
    expect(screen.getByText("60 Peones")).toBeInTheDocument();
  });

  it("snaps an off-ladder initialAmount rather than breaking the sheet", () => {
    open({ initialAmount: 37 });
    expect(stepper()).toHaveAttribute("data-amount", "35");
  });

  it("clamps an out-of-range initialAmount to the bounds", () => {
    const { unmount } = open({ initialAmount: 5_000 });
    expect(stepper()).toHaveAttribute("data-amount", "100");
    unmount();
    open({ initialAmount: -12 });
    expect(stepper()).toHaveAttribute("data-amount", "5");
  });

  it("locks the amount while a transfer is in flight", () => {
    // The signed transfer commits to a SKU. Letting the amount move after the
    // wallet prompt would desync what the player sees from what they paid.
    for (const phase of ["preparing", "awaiting_signature", "pending_tx", "verifying"] as const) {
      mockedRail.mockReturnValue(railState({ phase }));
      mockedSel.mockReturnValue(selState());
      const { unmount } = renderSheet();
      expect(minus()).toBeDisabled();
      expect(plus()).toBeDisabled();
      unmount();
    }
  });
});
