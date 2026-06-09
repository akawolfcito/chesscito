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
  it("renders the pack (50 Peones) and price ($0.50)", () => {
    mockedRail.mockReturnValue(railState());
    mockedSel.mockReturnValue(selState());
    renderSheet();
    expect(screen.getByText("50 Peones")).toBeInTheDocument();
    expect(screen.getAllByText("$0.50").length).toBeGreaterThan(0);
  });

  it("renders the auto-selected token in the picker and pay label", () => {
    mockedRail.mockReturnValue(railState());
    mockedSel.mockReturnValue(selState());
    renderSheet();
    expect(screen.getByTestId("get-peones-token-picker")).toHaveValue("USDT");
    expect(screen.getByTestId("get-peones-pay")).toHaveTextContent("Pay 0.50 USDT");
  });

  it("changing the picker calls setSelectedSymbol", () => {
    const setSelectedSymbol = vi.fn();
    mockedRail.mockReturnValue(railState());
    mockedSel.mockReturnValue(selState({ setSelectedSymbol }));
    renderSheet();
    fireEvent.change(screen.getByTestId("get-peones-token-picker"), { target: { value: "USDC" } });
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
    expect(screen.getByText(/amount_too_low/)).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("get-peones-verify-again"));
    expect(verifyAgain).toHaveBeenCalledTimes(1);
  });

  it("passes onSuccess to usePaymentRail as onVerified", () => {
    const onSuccess = vi.fn();
    mockedRail.mockReturnValue(railState());
    mockedSel.mockReturnValue(selState());
    renderSheet({ onSuccess });
    expect(mockedRail).toHaveBeenCalledWith(
      expect.objectContaining({ sku: "peones_pack_50", tokenSymbol: "USDT", onVerified: onSuccess }),
    );
  });

  it("shows the no-approve promise and never an approve action", () => {
    mockedRail.mockReturnValue(railState());
    mockedSel.mockReturnValue(selState());
    renderSheet();
    expect(screen.getByText(/1 transaction, no approve/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^approve$/i })).not.toBeInTheDocument();
  });
});
