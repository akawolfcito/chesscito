import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderWithIntl as render, screen } from "@/test-utils/render-with-intl";

import { AccountSheet } from "../account-sheet";
import { ACCOUNT_SHEET_COPY } from "@/lib/content/editorial";

const useMiniPay = vi.hoisted(() => vi.fn());

vi.mock("@/hooks/use-minipay", () => ({ useMiniPay }));
vi.mock("@/lib/founder/use-founder-status", () => ({ useFounderStatus: () => false }));
vi.mock("@/lib/shop/use-shields-count", () => ({ useShieldsCount: () => 0 }));
vi.mock("@/components/peones/chesito-card", () => ({ ChesitoCard: () => null }));

function renderSheet() {
  return render(
    <AccountSheet
      open
      onOpenChange={() => {}}
      walletAddress="0xC7E2000000000000000000000000000000000DE69"
      walletShort="0xC7E2...DE69"
      chainId={42220}
      proActive={false}
      proExpiresAt={null}
      coachCredits={0}
      onManagePro={() => {}}
      onOpenCoach={() => {}}
      onOpenShieldsHelp={() => {}}
      onOpenShop={() => {}}
      onDisconnect={() => {}}
    />,
  );
}

describe("AccountSheet — MiniPay has one wallet and no way out", () => {
  beforeEach(() => {
    useMiniPay.mockReset();
  });

  it("keeps copy + disconnect in a normal browser wallet", () => {
    useMiniPay.mockReturnValue({ hasProvider: true, isMiniPay: false, isReady: true });
    renderSheet();

    expect(
      screen.getByRole("button", { name: ACCOUNT_SHEET_COPY.copyAddress }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: ACCOUNT_SHEET_COPY.disconnect }),
    ).toBeInTheDocument();
  });

  it("makes the wallet tile read-only inside MiniPay", () => {
    useMiniPay.mockReturnValue({ hasProvider: true, isMiniPay: true, isReady: true });
    renderSheet();

    expect(
      screen.queryByRole("button", { name: ACCOUNT_SHEET_COPY.copyAddress }),
    ).not.toBeInTheDocument();
    expect(screen.getByText("0xC7E2...DE69")).toBeInTheDocument();
  });

  it("hides Disconnect inside MiniPay", () => {
    useMiniPay.mockReturnValue({ hasProvider: true, isMiniPay: true, isReady: true });
    renderSheet();

    expect(
      screen.queryByRole("button", { name: ACCOUNT_SHEET_COPY.disconnect }),
    ).not.toBeInTheDocument();
  });

  it("does not flash Disconnect before the provider is read", () => {
    // The hook reports isMiniPay:false until its effect runs. Rendering the
    // MiniPay-only branches off that pre-hydration value would show the
    // button and then yank it — decide only once isReady.
    useMiniPay.mockReturnValue({ hasProvider: false, isMiniPay: false, isReady: false });
    renderSheet();

    expect(
      screen.queryByRole("button", { name: ACCOUNT_SHEET_COPY.disconnect }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: ACCOUNT_SHEET_COPY.copyAddress }),
    ).not.toBeInTheDocument();
  });
});
