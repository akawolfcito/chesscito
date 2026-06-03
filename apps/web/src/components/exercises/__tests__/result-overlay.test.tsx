import { describe, it, expect, vi, beforeEach } from "vitest";

import { renderWithIntl, screen } from "@/test-utils/render-with-intl";
import { ResultOverlay } from "../result-overlay";

// Lottie loads JSON via import — under jsdom the animation doesn't
// paint, which is fine since we're only asserting DOM + interactivity.
vi.mock("@/components/ui/lottie-animation", () => ({
  LottieAnimation: () => null,
}));

// ShareModal is irrelevant to error-path assertions and pulls in
// dynamic locale data that the test bundle doesn't need.
vi.mock("@/components/share/share-modal", () => ({
  ShareModal: () => null,
}));

// AddCashCta reads useMiniPay — control it per test so we can assert
// both the in-MiniPay (CTA visible) and out-of-MiniPay (CTA hidden)
// branches of the insufficient-funds recovery affordance.
vi.mock("@/hooks/use-minipay", () => ({
  useMiniPay: vi.fn(() => ({ isReady: true, isMiniPay: false, hasProvider: false })),
}));
import { useMiniPay } from "@/hooks/use-minipay";

const setMiniPay = (isMiniPay: boolean) => {
  (useMiniPay as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
    isReady: true,
    isMiniPay,
    hasProvider: false,
  });
};

describe("ResultOverlay — Add Cash deeplink CTA", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const errorProps = {
    variant: "error" as const,
    errorKind: "error" as const,
    errorMessage: "Insufficient balance",
    onDismiss: vi.fn(),
  };

  it("renders the AddCashCta when txErrorKind=insufficientFunds inside MiniPay", () => {
    setMiniPay(true);
    renderWithIntl(
      <ResultOverlay {...errorProps} txErrorKind="insufficientFunds" />,
    );
    const link = screen.getByRole("link", { name: /Deposit in MiniPay/i });
    expect(link).toHaveAttribute("href", "https://minipay.opera.com/add_cash");
  });

  it("hides the AddCashCta outside MiniPay even when txErrorKind=insufficientFunds", () => {
    setMiniPay(false);
    renderWithIntl(
      <ResultOverlay {...errorProps} txErrorKind="insufficientFunds" />,
    );
    expect(
      screen.queryByRole("link", { name: /Deposit in MiniPay/i }),
    ).not.toBeInTheDocument();
  });

  it("hides the AddCashCta when txErrorKind is undefined (non-shop error paths)", () => {
    setMiniPay(true);
    renderWithIntl(
      <ResultOverlay {...errorProps} />,
    );
    expect(
      screen.queryByRole("link", { name: /Deposit in MiniPay/i }),
    ).not.toBeInTheDocument();
  });

  it("hides the AddCashCta when txErrorKind is a non-insufficient kind (e.g. network)", () => {
    setMiniPay(true);
    renderWithIntl(
      <ResultOverlay {...errorProps} txErrorKind="network" />,
    );
    expect(
      screen.queryByRole("link", { name: /Deposit in MiniPay/i }),
    ).not.toBeInTheDocument();
  });

  it("hides the AddCashCta on success variants even with txErrorKind set", () => {
    setMiniPay(true);
    renderWithIntl(
      <ResultOverlay
        variant="shop"
        itemLabel="Founder Badge"
        onDismiss={vi.fn()}
        txErrorKind="insufficientFunds"
      />,
    );
    expect(
      screen.queryByRole("link", { name: /Deposit in MiniPay/i }),
    ).not.toBeInTheDocument();
  });
});
