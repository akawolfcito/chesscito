import { describe, expect, it, vi } from "vitest";
import { fireEvent } from "@testing-library/react";
import { renderWithIntl as render, screen } from "@/test-utils/render-with-intl";

vi.mock("@/lib/payments/use-payment-rail", () => ({ usePaymentRail: vi.fn() }));

import { GetPeonesSheet } from "@/components/payments/get-peones-sheet";
import { usePaymentRail } from "@/lib/payments/use-payment-rail";

const mockedRail = vi.mocked(usePaymentRail);
const HASH = `0x${"a".repeat(64)}`;

type RailReturn = ReturnType<typeof usePaymentRail>;
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

function renderSheet(props: Partial<Parameters<typeof GetPeonesSheet>[0]> = {}) {
  return render(
    <GetPeonesSheet
      open
      onOpenChange={vi.fn()}
      tokenSymbol="USDT"
      {...props}
    />,
  );
}

describe("GetPeonesSheet", () => {
  it("renders the pack (50 Peones) and price ($0.50)", () => {
    mockedRail.mockReturnValue(railState());
    renderSheet();
    expect(screen.getByText("50 Peones")).toBeInTheDocument();
    expect(screen.getAllByText("$0.50").length).toBeGreaterThan(0);
  });

  it("renders the selected token", () => {
    mockedRail.mockReturnValue(railState());
    renderSheet({ tokenSymbol: "USDT" });
    expect(screen.getByText("Pay with USDT")).toBeInTheDocument();
    expect(screen.getByTestId("get-peones-pay")).toHaveTextContent("Pay 0.50 USDT");
  });

  it("the pay button calls pay()", () => {
    const pay = vi.fn();
    mockedRail.mockReturnValue(railState({ pay }));
    renderSheet();
    fireEvent.click(screen.getByTestId("get-peones-pay"));
    expect(pay).toHaveBeenCalledTimes(1);
  });

  it("unavailable → no active pay button, shows the reason", () => {
    mockedRail.mockReturnValue(railState({ available: false, unavailableReason: "wrong_chain" }));
    renderSheet();
    expect(screen.queryByTestId("get-peones-pay")).not.toBeInTheDocument();
    expect(screen.getByText(/Switch your wallet to Celo/i)).toBeInTheDocument();
  });

  it("loading state disables the button and changes the copy", () => {
    mockedRail.mockReturnValue(railState({ phase: "awaiting_signature" }));
    renderSheet();
    const btn = screen.getByTestId("get-peones-pay");
    expect(btn).toBeDisabled();
    expect(btn).toHaveTextContent("Confirm in your wallet");
  });

  it("success shows +50 Peones credited", () => {
    mockedRail.mockReturnValue(
      railState({
        phase: "success",
        result: { txHash: HASH, duplicate: false, peonesCredited: 50, token: "0x", amountPaid: "500000", overpaid: false },
      }),
    );
    renderSheet();
    expect(screen.getByText("+50 Peones credited")).toBeInTheDocument();
  });

  it("duplicate:true is shown as success (no double charge)", () => {
    mockedRail.mockReturnValue(
      railState({
        phase: "success",
        result: { txHash: HASH, duplicate: true, peonesCredited: 50, token: "0x", amountPaid: "500000", overpaid: false },
      }),
    );
    renderSheet();
    expect(screen.getByText("+50 Peones credited")).toBeInTheDocument();
    expect(screen.getByText(/no double charge/i)).toBeInTheDocument();
  });

  it("verify failure with a txHash shows Verify again", () => {
    mockedRail.mockReturnValue(
      railState({ phase: "error", errorReason: "amount_too_low", txHash: HASH as `0x${string}` }),
    );
    renderSheet();
    expect(screen.getByText(/amount_too_low/)).toBeInTheDocument();
    expect(screen.getByTestId("get-peones-verify-again")).toBeInTheDocument();
  });

  it("Verify again calls verifyAgain()", () => {
    const verifyAgain = vi.fn();
    mockedRail.mockReturnValue(
      railState({ phase: "error", errorReason: "amount_too_low", txHash: HASH as `0x${string}`, verifyAgain }),
    );
    renderSheet();
    fireEvent.click(screen.getByTestId("get-peones-verify-again"));
    expect(verifyAgain).toHaveBeenCalledTimes(1);
  });

  it("passes onSuccess to usePaymentRail as onVerified", () => {
    const onSuccess = vi.fn();
    mockedRail.mockReturnValue(railState());
    renderSheet({ onSuccess });
    expect(mockedRail).toHaveBeenCalledWith(
      expect.objectContaining({ sku: "peones_pack_50", tokenSymbol: "USDT", onVerified: onSuccess }),
    );
  });

  it("shows the no-approve promise and never an approve action", () => {
    mockedRail.mockReturnValue(railState());
    renderSheet();
    expect(screen.getByText(/1 transaction, no approve/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^approve$/i })).not.toBeInTheDocument();
  });
});
