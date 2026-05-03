import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";

const trackMock = vi.hoisted(() => vi.fn());
const pushMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/telemetry", () => ({ track: trackMock }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

import { ProSheet, type ProSheetProps } from "../pro-sheet";
import { PRO_COPY } from "@/lib/content/editorial";

afterEach(() => {
  cleanup();
  trackMock.mockReset();
  pushMock.mockReset();
  vi.unstubAllEnvs();
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

  it("does NOT render the retry CTA on a generic (non-verify-failed) error", () => {
    renderSheet({ errorMessage: PRO_COPY.errors.purchaseFailed });
    expect(screen.queryByTestId("pro-error-retry")).not.toBeInTheDocument();
    expect(screen.queryByTestId("pro-error-reassurance")).not.toBeInTheDocument();
  });

  it("renders the retry CTA + reassurance copy when verifyFailedTxHash is set and onRetryVerify is provided", () => {
    const onRetryVerify = vi.fn();
    renderSheet({
      errorMessage: PRO_COPY.errors.verifyFailedTitle,
      verifyFailedTxHash: "0x" + "a".repeat(64),
      onRetryVerify,
    });
    expect(screen.getByTestId("pro-error-reassurance")).toHaveTextContent(
      PRO_COPY.errors.verifyFailedReassurance,
    );
    const retry = screen.getByTestId("pro-error-retry");
    expect(retry).toHaveTextContent(PRO_COPY.errors.retryVerifyCta);
    fireEvent.click(retry);
    expect(onRetryVerify).toHaveBeenCalledTimes(1);
  });

  it("disables the retry button + swaps the label while isRetryingVerify is true", () => {
    const onRetryVerify = vi.fn();
    renderSheet({
      errorMessage: PRO_COPY.errors.verifyFailedTitle,
      verifyFailedTxHash: "0x" + "a".repeat(64),
      isRetryingVerify: true,
      onRetryVerify,
    });
    const retry = screen.getByTestId("pro-error-retry");
    expect(retry).toBeDisabled();
    expect(retry).toHaveTextContent(PRO_COPY.errors.retryingVerify);
    fireEvent.click(retry);
    expect(onRetryVerify).not.toHaveBeenCalled();
  });

  describe("telemetry", () => {
    it("fires pro_card_viewed (surface=sheet) once per open", () => {
      renderSheet({ open: true });
      expect(trackMock).toHaveBeenCalledWith("pro_card_viewed", {
        surface: "sheet",
        active: false,
      });
      expect(trackMock).toHaveBeenCalledTimes(1);
    });

    it("does not fire pro_card_viewed when open is false", () => {
      renderSheet({ open: false });
      expect(trackMock).not.toHaveBeenCalledWith(
        "pro_card_viewed",
        expect.anything(),
      );
    });

    it("fires pro_cta_clicked with source=sheet_buy when tapping Get PRO", () => {
      renderSheet();
      trackMock.mockClear(); // drop the mount-time pro_card_viewed
      fireEvent.click(screen.getByRole("button", { name: PRO_COPY.ctaBuy }));

      expect(trackMock).toHaveBeenCalledWith("pro_cta_clicked", {
        source: "sheet_buy",
      });
    });

    it("fires pro_cta_clicked with source=sheet_renew when active and tapping Renew", () => {
      const NOW = Date.now();
      renderSheet({
        status: { active: true, expiresAt: NOW + 5 * 24 * 60 * 60 * 1000 },
      });
      trackMock.mockClear();
      fireEvent.click(screen.getByRole("button", { name: PRO_COPY.ctaRenew }));

      expect(trackMock).toHaveBeenCalledWith("pro_cta_clicked", {
        source: "sheet_renew",
      });
    });

    it("does not fire pro_cta_clicked for Connect Wallet (not commercial intent)", () => {
      renderSheet({ isConnected: false });
      trackMock.mockClear();
      fireEvent.click(screen.getByRole("button", { name: PRO_COPY.errors.walletRequired }));

      expect(trackMock).not.toHaveBeenCalledWith(
        "pro_cta_clicked",
        expect.anything(),
      );
    });

    it("does not fire pro_cta_clicked for Switch Network", () => {
      renderSheet({ isCorrectChain: false });
      trackMock.mockClear();
      fireEvent.click(screen.getByRole("button", { name: /switch network/i }));

      expect(trackMock).not.toHaveBeenCalledWith(
        "pro_cta_clicked",
        expect.anything(),
      );
    });
  });

  describe("active-state post-purchase CTA", () => {
    const NOW = Date.now();
    const FIVE_DAYS = NOW + 5 * 24 * 60 * 60 * 1000;
    const ACTIVE_STATUS = { active: true, expiresAt: FIVE_DAYS };

    it("renders the Play Arena CTA with Coach-enabled helper copy when active and ENABLE_COACH not 'false'", () => {
      renderSheet({ status: ACTIVE_STATUS });
      // Button label is constant across both Coach states.
      expect(
        screen.getByRole("button", { name: PRO_COPY.activeStateCta }),
      ).toBeInTheDocument();
      // Helper copy mentions Coach analysis (enabled variant).
      expect(
        screen.getByText(PRO_COPY.activeStateCopyEnabled),
      ).toBeInTheDocument();
    });

    it("routes to /arena when the Play Arena CTA is tapped", () => {
      renderSheet({ status: ACTIVE_STATUS });
      fireEvent.click(
        screen.getByRole("button", { name: PRO_COPY.activeStateCta }),
      );
      expect(pushMock).toHaveBeenCalledWith("/arena");
      expect(pushMock).toHaveBeenCalledTimes(1);
    });

    it("uses the disabled-state helper copy when ENABLE_COACH is explicitly 'false'", () => {
      vi.stubEnv("NEXT_PUBLIC_ENABLE_COACH", "false");
      renderSheet({ status: ACTIVE_STATUS });
      // Button label unchanged — still routes to /arena.
      expect(
        screen.getByRole("button", { name: PRO_COPY.activeStateCta }),
      ).toBeInTheDocument();
      // Helper copy adapts: no promise of direct Coach access.
      expect(
        screen.getByText(PRO_COPY.activeStateCopyDisabled),
      ).toBeInTheDocument();
      expect(
        screen.queryByText(PRO_COPY.activeStateCopyEnabled),
      ).not.toBeInTheDocument();
    });

    it("does NOT render the Play Arena CTA when status is inactive", () => {
      renderSheet({ status: { active: false, expiresAt: null } });
      expect(
        screen.queryByRole("button", { name: PRO_COPY.activeStateCta }),
      ).not.toBeInTheDocument();
    });

    it("does NOT change the existing Renew CTA behavior", () => {
      const handlers = renderSheet({ status: ACTIVE_STATUS });
      // Renew button still present and still fires onPurchase.
      const renew = screen.getByRole("button", { name: PRO_COPY.ctaRenew });
      fireEvent.click(renew);
      expect(handlers.onPurchase).toHaveBeenCalledTimes(1);
      // Play Arena CTA should NOT route to /arena when Renew was clicked.
      expect(pushMock).not.toHaveBeenCalled();
    });
  });
});
