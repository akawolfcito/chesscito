import { describe, expect, it, vi } from "vitest";
import { renderWithIntl as render, screen } from "@/test-utils/render-with-intl";
import { LearnShopSheet } from "../learn-shop-sheet";

// SeasonPassSheet (rendered by LearnShopSheet) reads `useAccount()`; without a
// WagmiProvider in the test tree it throws. Mirror the mock used by
// season-pass-sheet.test.tsx so this wrapper test renders standalone.
vi.mock("wagmi", () => ({
  useAccount: () => ({ address: "0xaaaabbbbccccddddeeeeffff0000111122223333" }),
}));
vi.mock("@/lib/feature-flags", () => ({ CHESSCITO_LITE_MODE: true }));
vi.mock("@/lib/payments/use-get-peones-token-selection", () => ({
  useStablecoinTokenSelection: () => ({
    selectedSymbol: "USDC",
    selected: null,
    tokens: [],
    noPayableToken: true,
    setSelectedSymbol: () => {},
  }),
}));
vi.mock("@/lib/season-pass/use-season-pass-rail", () => ({
  useSeasonPassRail: () => ({ phase: "idle", available: true, pay: () => {} }),
  mapSeasonPassError: () => "",
}));

describe("LearnShopSheet", () => {
  it("renders the Season Pass content when open", () => {
    render(<LearnShopSheet open={true} onOpenChange={() => {}} />);
    expect(screen.getByTestId("season-pass-sheet")).toBeInTheDocument();
  });
});
