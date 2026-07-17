import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderWithIntl as render, screen, within } from "@/test-utils/render-with-intl";

import { AccountSheet } from "../account-sheet";
import { ACCOUNT_SHEET_COPY, IDENTITY_COPY } from "@/lib/content/editorial";
import {
  deriveAvatarVariant,
  formatNickname,
} from "@/lib/identity/identity-lite";
import { displayNameStorageKey } from "@/hooks/use-display-name";

const useMiniPay = vi.hoisted(() => vi.fn());

vi.mock("@/hooks/use-minipay", () => ({ useMiniPay }));
vi.mock("@/lib/founder/use-founder-status", () => ({ useFounderStatus: () => false }));
vi.mock("@/lib/shop/use-shields-count", () => ({ useShieldsCount: () => 0 }));
vi.mock("@/components/peones/chesito-card", () => ({ ChesitoCard: () => null }));

const WALLET = "0xC7E2000000000000000000000000000000000DE6" as const;

/** The nickname the leaderboard shows every OTHER player for this wallet. */
const GENERATED_NICKNAME = formatNickname(
  deriveAvatarVariant(WALLET.toLowerCase()),
  {
    pieces: IDENTITY_COPY.pieces,
    styles: IDENTITY_COPY.styles,
    guestPrefix: IDENTITY_COPY.guestPrefix,
    template: IDENTITY_COPY.template,
  },
);

function renderSheet() {
  return render(
    <AccountSheet
      open
      onOpenChange={() => {}}
      walletAddress={WALLET}
      walletShort="0xC7E2...0DE6"
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

describe("AccountSheet — Chesscito ID chip", () => {
  beforeEach(() => {
    window.localStorage.clear();
    useMiniPay.mockReset();
    useMiniPay.mockReturnValue({ hasProvider: true, isMiniPay: true, isReady: true });
  });

  it("shows the generated nickname under a Chesscito ID label", () => {
    renderSheet();
    const chip = screen.getByRole("group", {
      name: ACCOUNT_SHEET_COPY.chesscitoIdLabel,
    });

    expect(within(chip).getByText(GENERATED_NICKNAME)).toBeInTheDocument();
    expect(
      within(chip).getByText(ACCOUNT_SHEET_COPY.chesscitoIdLabel),
    ).toBeInTheDocument();
  });

  it("shows the same nickname the leaderboard shows others, not a local custom name", () => {
    // The custom display name lives only in this device's localStorage — it
    // never reaches the server, so every other player still sees the
    // generated nickname. A chip that showed the custom name would name the
    // user something nobody else can see, defeating the chip's whole job.
    window.localStorage.setItem(displayNameStorageKey(WALLET), "Wolfcito");
    renderSheet();

    expect(screen.getByText(GENERATED_NICKNAME)).toBeInTheDocument();
    expect(screen.queryByText("Wolfcito")).not.toBeInTheDocument();
  });

  it("carries no edit control — the ID is derived, not chosen", () => {
    renderSheet();
    const chip = screen.getByRole("group", {
      name: ACCOUNT_SHEET_COPY.chesscitoIdLabel,
    });

    expect(within(chip).queryByRole("button")).not.toBeInTheDocument();
  });
});
