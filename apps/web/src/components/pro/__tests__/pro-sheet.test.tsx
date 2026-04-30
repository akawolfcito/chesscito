import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";

import { ProSheet, type ProSheetProps } from "../pro-sheet";
import { PRO_COPY } from "@/lib/content/editorial";

afterEach(() => {
  cleanup();
});

function renderSheet(overrides: Partial<ProSheetProps> = {}) {
  const handlers = {
    onOpenChange: vi.fn(),
    onConnectWallet: vi.fn(),
    onSwitchNetwork: vi.fn(),
    onPurchase: vi.fn(),
  };

  const props: ProSheetProps = {
    open: true,
    status: { active: false, expiresAt: null },
    isConnected: true,
    isCorrectChain: true,
    isPurchasing: false,
    isVerifying: false,
    errorMessage: null,
    ...handlers,
    ...overrides,
  };

  render(<ProSheet {...props} />);
  return handlers;
}

describe("ProSheet", () => {
  it("renders the price label and active perks list when open", () => {
    renderSheet();
    expect(screen.getByText(PRO_COPY.priceLabel)).toBeInTheDocument();
    expect(screen.getByText(PRO_COPY.perksActive[0])).toBeInTheDocument();
  });

  it("renders the roadmap perks under a 'Coming later' heading", () => {
    renderSheet();
    expect(screen.getByTestId("pro-roadmap")).toBeInTheDocument();
    expect(screen.getByText(PRO_COPY.perksRoadmap[0])).toBeInTheDocument();
  });

  it("shows the Connect Wallet CTA when wallet is not connected", () => {
    const handlers = renderSheet({ isConnected: false });
    const cta = screen.getByRole("button", { name: PRO_COPY.errors.walletRequired });
    fireEvent.click(cta);
    expect(handlers.onConnectWallet).toHaveBeenCalledTimes(1);
    expect(handlers.onPurchase).not.toHaveBeenCalled();
  });

  it("shows Switch Network when wallet is connected on the wrong chain", () => {
    const handlers = renderSheet({ isCorrectChain: false });
    const cta = screen.getByRole("button", { name: /switch network/i });
    fireEvent.click(cta);
    expect(handlers.onSwitchNetwork).toHaveBeenCalledTimes(1);
    expect(handlers.onPurchase).not.toHaveBeenCalled();
  });

  it("shows Get PRO and routes click to onPurchase when connected and inactive", () => {
    const handlers = renderSheet();
    const cta = screen.getByRole("button", { name: PRO_COPY.ctaBuy });
    fireEvent.click(cta);
    expect(handlers.onPurchase).toHaveBeenCalledTimes(1);
  });

  it("shows the Renew CTA when PRO is currently active", () => {
    const NOW = Date.now();
    const handlers = renderSheet({
      status: { active: true, expiresAt: NOW + 5 * 24 * 60 * 60 * 1000 },
    });
    const cta = screen.getByRole("button", { name: PRO_COPY.ctaRenew });
    fireEvent.click(cta);
    expect(handlers.onPurchase).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("pro-active-banner")).toBeInTheDocument();
  });

  it("disables the CTA while purchasing", () => {
    renderSheet({ isPurchasing: true });
    const cta = screen.getByRole("button", { name: /processing/i });
    expect(cta).toBeDisabled();
  });

  it("disables the CTA while verifying", () => {
    renderSheet({ isVerifying: true });
    const cta = screen.getByRole("button", { name: /verifying/i });
    expect(cta).toBeDisabled();
  });

  it("renders an error region when errorMessage is set", () => {
    renderSheet({ errorMessage: PRO_COPY.errors.purchaseFailed });
    expect(screen.getByTestId("pro-error")).toHaveTextContent(PRO_COPY.errors.purchaseFailed);
  });
});
