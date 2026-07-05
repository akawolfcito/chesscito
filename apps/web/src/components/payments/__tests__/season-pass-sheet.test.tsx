import { describe, expect, it, vi } from "vitest";
import { renderWithIntl as render, screen } from "@/test-utils/render-with-intl";

const statusMock = vi.hoisted(() => vi.fn());
const railMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/feature-flags", () => ({ CHESSCITO_LITE_MODE: true }));
vi.mock("wagmi", () => ({
  useAccount: () => ({ address: "0xaaaabbbbccccddddeeeeffff0000111122223333" }),
  useChainId: () => 42220,
  usePublicClient: () => undefined,
  useWriteContract: () => ({ writeContractAsync: vi.fn() }),
}));
vi.mock("@/lib/season-pass/use-season-pass-status", () => ({
  useSeasonPassStatus: statusMock,
}));
vi.mock("@/lib/season-pass/use-season-pass-rail", () => ({
  useSeasonPassRail: railMock,
}));
vi.mock("@/lib/payments/use-get-peones-token-selection", () => ({
  useStablecoinTokenSelection: () => ({
    selectedSymbol: "USDC",
    selected: { symbol: "USDC", balance: 5_000_000n, decimals: 6, payable: true },
    tokens: [],
    noPayableToken: false,
    setSelectedSymbol: vi.fn(),
  }),
}));

import { SeasonPassSheet } from "../season-pass-sheet";

function defaultRail() {
  return {
    phase: "idle",
    result: null,
    errorReason: null,
    available: true,
    pay: vi.fn(),
  };
}

describe("SeasonPassSheet", () => {
  it("shows Included with PRO and does not render a purchase CTA", () => {
    statusMock.mockReturnValue({
      active: true,
      source: "pro",
      loading: false,
      seasonPassExpiresAt: null,
      proExpiresAt: Date.now() + 86_400_000,
      shieldsCredited: 0,
    });
    railMock.mockReturnValue(defaultRail());

    render(<SeasonPassSheet open={true} onOpenChange={() => {}} />);

    expect(screen.getByTestId("season-pass-included-pro")).toHaveTextContent(
      "Included with PRO",
    );
    expect(screen.queryByTestId("season-pass-pay")).toBeNull();
    expect(screen.queryByText(/\+3 shields/i)).toBeNull();
  });

  it("keeps the direct Season Pass offer and +3 Shields for an inactive user", () => {
    statusMock.mockReturnValue({
      active: false,
      source: null,
      loading: false,
      seasonPassExpiresAt: null,
      proExpiresAt: null,
      shieldsCredited: 0,
    });
    railMock.mockReturnValue(defaultRail());

    render(<SeasonPassSheet open={true} onOpenChange={() => {}} />);

    expect(screen.getByTestId("season-pass-pay")).toBeInTheDocument();
    expect(screen.getByText(/\+3 shields/i)).toBeInTheDocument();
  });
});
