import { describe, it, expect, vi, beforeEach } from "vitest";
import userEvent from "@testing-library/user-event";

import { renderWithIntl, screen } from "@/test-utils/render-with-intl";
import { AddCashCta } from "../add-cash-cta";

// Mock useMiniPay so we can drive each state explicitly.
vi.mock("@/hooks/use-minipay", () => ({
  useMiniPay: vi.fn(),
}));
import { useMiniPay } from "@/hooks/use-minipay";

// Mock telemetry to assert the click event payload.
vi.mock("@/lib/telemetry", () => ({
  track: vi.fn(),
}));
import { track } from "@/lib/telemetry";

const setMiniPay = (opts: Partial<{ isReady: boolean; isMiniPay: boolean }>) => {
  (useMiniPay as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
    isReady: opts.isReady ?? true,
    isMiniPay: opts.isMiniPay ?? false,
    hasProvider: false,
  });
};

describe("AddCashCta", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders nothing while MiniPay detection is in flight", () => {
    setMiniPay({ isReady: false, isMiniPay: false });
    const { container } = renderWithIntl(<AddCashCta source="mint-victory" />);
    expect(container.firstChild).toBeNull();
  });

  it("renders nothing outside MiniPay (gated by isMiniPay)", () => {
    setMiniPay({ isReady: true, isMiniPay: false });
    const { container } = renderWithIntl(<AddCashCta source="mint-victory" />);
    expect(container.firstChild).toBeNull();
  });

  it("renders the EN label when isMiniPay", () => {
    setMiniPay({ isReady: true, isMiniPay: true });
    renderWithIntl(<AddCashCta source="mint-victory" />, { locale: "en" });
    expect(screen.getByText("Deposit in MiniPay")).toBeInTheDocument();
  });

  it("renders the ES label when isMiniPay", () => {
    setMiniPay({ isReady: true, isMiniPay: true });
    renderWithIntl(<AddCashCta source="mint-victory" />, { locale: "es" });
    expect(screen.getByText("Agregar fondos")).toBeInTheDocument();
  });

  it("points the deeplink to the official MiniPay add_cash URL", () => {
    setMiniPay({ isReady: true, isMiniPay: true });
    renderWithIntl(<AddCashCta source="mint-victory" />);
    const link = screen.getByRole("link", { name: /Deposit in MiniPay/i });
    expect(link).toHaveAttribute("href", "https://minipay.opera.com/add_cash");
  });

  it("emits minipay_add_cash_click telemetry with the source on tap", async () => {
    setMiniPay({ isReady: true, isMiniPay: true });
    renderWithIntl(<AddCashCta source="shop-buy" />);
    const link = screen.getByRole("link", { name: /Deposit in MiniPay/i });
    await userEvent.click(link);
    expect(track).toHaveBeenCalledWith("minipay_add_cash_click", { source: "shop-buy" });
  });
});
