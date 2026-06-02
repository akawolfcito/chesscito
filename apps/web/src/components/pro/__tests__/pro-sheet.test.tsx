import { describe, it, expect, vi, afterEach } from "vitest";
import { cleanup } from "@testing-library/react";
import { renderWithIntl as render, screen, fireEvent } from "@/test-utils/render-with-intl";

const trackMock = vi.hoisted(() => vi.fn());
const pushMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/telemetry", () => ({ track: trackMock }));
const pathnameMock = vi.hoisted(() => vi.fn(() => "/hub"));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
  usePathname: pathnameMock,
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

  // AC-3.8 — addendum §3.6 / §6.1 commit #4 — kicker now renders as
  // the uppercase "TRAINING PASS" pill in the candy-panel redesign,
  // sourced from PRO_COPY.trainingPassLabel.
  it("renders the kicker pill above the title", () => {
    renderSheet();
    const kicker = screen.getByText(PRO_COPY.trainingPassLabel);
    const title = screen.getByRole("heading", { name: PRO_COPY.label });
    expect(kicker).toBeInTheDocument();
    expect(
      kicker.compareDocumentPosition(title) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("shows the Connect Wallet CTA when wallet is not connected", () => {
    const handlers = renderSheet({ isConnected: false });
    const cta = screen.getByRole("button", { name: PRO_COPY.ctaConnectWallet });
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

  // The bottom Renew CTA was removed when PRO is active (the principal
  // button is gated on !showActiveBanner). The active state now renders
  // 3 contextual actions: pro-open-journal (primary), pro-active-cta
  // (secondary "Play in Arena"), and pro-extend-link (only when
  // expiring ≤ 3 days). The legacy "Renew CTA when active" test was
  // removed; the active-state behavior is covered by the dedicated
  // describe block below.

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
      // M1 funnel (Commit 5) — pro_card_viewed ships exactly once, but
      // mount also fires the monetization.pro_sheet_view companion. Filter
      // to the legacy event so this assertion stays focused.
      const proCardCalls = trackMock.mock.calls.filter(
        ([name]) => name === "pro_card_viewed",
      );
      expect(proCardCalls).toHaveLength(1);
    });

    it("fires monetization.pro_sheet_view on open (M1 funnel)", () => {
      renderSheet({ open: true });
      expect(trackMock).toHaveBeenCalledWith("monetization.pro_sheet_view", {
        active: false,
      });
      const m1Calls = trackMock.mock.calls.filter(
        ([name]) => name === "monetization.pro_sheet_view",
      );
      expect(m1Calls).toHaveLength(1);
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

    // pro_cta_clicked source=sheet_renew was emitted by the bottom
    // Renew button when PRO was active. That CTA no longer renders;
    // the renew flow now goes through pro-extend-link (only when
    // expiring) which emits pro_extend_tap instead. The dedicated
    // expiring-sub-line block below covers pro_extend_tap.

    it("does not fire pro_cta_clicked for Connect Wallet (not commercial intent)", () => {
      renderSheet({ isConnected: false });
      trackMock.mockClear();
      fireEvent.click(screen.getByRole("button", { name: PRO_COPY.ctaConnectWallet }));

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

  describe("active-state — badge + surface-aware CTA + expiring sub-line", () => {
    const NOW = Date.now();
    const TEN_DAYS = NOW + 10 * 24 * 60 * 60 * 1000;
    const TWO_DAYS = NOW + 2 * 24 * 60 * 60 * 1000;
    const ACTIVE_STATUS = { active: true, expiresAt: TEN_DAYS };

    it("renders the ProActiveBadge inside pro-active-banner when active", () => {
      renderSheet({ status: ACTIVE_STATUS });
      expect(screen.getByTestId("pro-active-banner")).toBeInTheDocument();
      expect(screen.getByTestId("pro-active-badge-pill")).toHaveTextContent(
        PRO_COPY.statusBadgeActive,
      );
    });

    it("renders ProActiveCTA navigational variant when source is not /arena", () => {
      renderSheet({ status: ACTIVE_STATUS });
      const button = screen.getByTestId("pro-active-cta-button");
      expect(button).toHaveTextContent(PRO_COPY.activeCtaPlay);
      fireEvent.click(button);
      expect(pushMock).toHaveBeenCalledWith("/arena?fresh=1");
    });

    it("prioritizes Training Journal as the first active PRO action", () => {
      // Post-redesign: the active sheet renders 2 ordered actions —
      // pro-open-journal (primary) then pro-active-cta (secondary
      // "Play in Arena"). The bottom Renew CTA was retired; renew now
      // goes through pro-extend-link, only when expiring ≤ 3 days.
      const handlers = renderSheet({ status: ACTIVE_STATUS });
      const journal = screen.getByTestId("pro-open-journal");
      const play = screen.getByTestId("pro-active-cta-button");

      expect(journal).toHaveTextContent(PRO_COPY.activeActions.journal);
      expect(
        journal.compareDocumentPosition(play) & Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();

      fireEvent.click(journal);
      expect(handlers.onOpenChange).toHaveBeenCalledWith(false);
      expect(pushMock).toHaveBeenCalledWith("/coach/history");
    });

    it("tracks Training Journal taps from the active PRO sheet", () => {
      renderSheet({ status: ACTIVE_STATUS });
      trackMock.mockClear();

      fireEvent.click(screen.getByTestId("pro-open-journal"));

      expect(trackMock).toHaveBeenCalledWith("pro_training_card_cta_tap", {
        surface: "pro_sheet",
        pro_active: true,
        wallet_connected: true,
        cta: "training_journal",
      });
    });

    it("does NOT render the active-state surfaces when status is inactive", () => {
      renderSheet({ status: { active: false, expiresAt: null } });
      expect(screen.queryByTestId("pro-active-banner")).not.toBeInTheDocument();
      expect(screen.queryByTestId("pro-active-actions")).not.toBeInTheDocument();
      expect(screen.queryByTestId("pro-active-cta")).not.toBeInTheDocument();
    });

    // The "Renew CTA behavior" guard is obsolete — the bottom Renew
    // button was removed when PRO is active (see comment in
    // resolveCta() at pro-sheet.tsx). Renew flow now goes through
    // pro-extend-link, covered by the expiring-sub-line block.

    describe("expiring sub-line (daysLeft ≤ 3)", () => {
      const EXPIRING_STATUS = { active: true, expiresAt: TWO_DAYS };

      it("flips the badge to EXPIRING and renders the extend link", () => {
        renderSheet({ status: EXPIRING_STATUS });
        expect(screen.getByTestId("pro-active-badge-pill")).toHaveTextContent(
          PRO_COPY.statusBadgeExpiring,
        );
        expect(screen.getByTestId("pro-expiring-subline")).toHaveTextContent(
          PRO_COPY.expiringMicroCopy,
        );
        expect(screen.getByTestId("pro-extend-link")).toHaveTextContent(
          PRO_COPY.ctaRenew,
        );
      });

      it("does NOT render the sub-line when daysLeft > 3", () => {
        renderSheet({ status: ACTIVE_STATUS });
        expect(
          screen.queryByTestId("pro-expiring-subline"),
        ).not.toBeInTheDocument();
      });

      it("the extend link reuses the same purchase flow as the bottom Renew CTA", () => {
        const handlers = renderSheet({ status: EXPIRING_STATUS });
        fireEvent.click(screen.getByTestId("pro-extend-link"));
        expect(handlers.onPurchase).toHaveBeenCalledTimes(1);
      });

      it("the extend link emits pro_extend_tap telemetry", () => {
        renderSheet({ status: EXPIRING_STATUS });
        trackMock.mockClear();
        fireEvent.click(screen.getByTestId("pro-extend-link"));
        expect(trackMock).toHaveBeenCalledWith("pro_extend_tap", {
          source: expect.any(String),
        });
      });
    });
  });
});
