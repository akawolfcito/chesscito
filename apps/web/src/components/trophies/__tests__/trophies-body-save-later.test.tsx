import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderWithIntl as render, screen } from "@/test-utils/render-with-intl";

/**
 * Save Later — Trophy Vitrine empty-state secondary CTA (2026-05-31).
 *
 * The "Or save a past victory →" link only renders when the connected
 * user has zero trophies AND has at least one match in their Coach
 * history. Gating prevents a brand-new user (0 history rows) from
 * being routed to an empty /coach/history dead-end.
 *
 * Mocks the wallet + data hooks so the empty-state branch is the only
 * thing rendered — we're not testing the loaded-trophies path here.
 */

const WALLET = "0xE2EE2EE2EE2EE2EE2EE2EE2EE2EE2EE2EE2EE2EE";

vi.mock("wagmi", () => ({
  useAccount: () => ({ address: WALLET, isConnected: true }),
}));

vi.mock("@/lib/wallet/use-connect-wallet", () => ({
  useConnectWallet: () => ({ connectWallet: vi.fn(), isConnecting: false }),
}));

vi.mock("@/lib/game/victory-events", () => ({
  // Configured = true so the body bypasses the "Trophies are offline"
  // branch and reaches the empty-state surface we want to test.
  getVictoryAddress: () => "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
}));

vi.mock("@/components/trophies/trophies-data-provider", () => ({
  useTrophiesData: () => ({
    victories: [],
    loading: false,
    error: null,
    reload: vi.fn(),
  }),
  // Re-export the helpers the body imports but doesn't exercise here.
  clearOptimisticVictory: vi.fn(),
  getOptimisticVictory: vi.fn(() => null),
  toVictoryEntry: vi.fn(),
}));

const useCoachHistoryCountMock = vi.fn();
vi.mock("@/lib/coach/use-coach-history-count", () => ({
  useCoachHistoryCount: () => useCoachHistoryCountMock(),
}));

// Stub the hall-of-fame fetch — TrophiesBody hits it on mount.
beforeEach(() => {
  globalThis.fetch = vi.fn(async () => ({
    ok: true,
    json: async () => [],
  }) as Response) as typeof fetch;
});

import { TrophiesBody } from "../trophies-body";

describe("<TrophiesBody> Save Later empty-state CTA", () => {
  it("hides the secondary link when historyRowCount is 0 (brand-new user)", async () => {
    useCoachHistoryCountMock.mockReturnValue({
      rowCount: 0,
      isLoading: false,
      refetch: vi.fn(),
    });
    render(<TrophiesBody />);
    expect(
      screen.queryByText(/or save a past victory/i),
    ).not.toBeInTheDocument();
  });

  it("hides the secondary link while history count is still loading (undefined)", async () => {
    useCoachHistoryCountMock.mockReturnValue({
      rowCount: undefined,
      isLoading: true,
      refetch: vi.fn(),
    });
    render(<TrophiesBody />);
    expect(
      screen.queryByText(/or save a past victory/i),
    ).not.toBeInTheDocument();
  });

  it("shows the secondary link when the user has at least one past match", async () => {
    useCoachHistoryCountMock.mockReturnValue({
      rowCount: 3,
      isLoading: false,
      refetch: vi.fn(),
    });
    render(<TrophiesBody />);
    const link = await screen.findByText(/or save a past victory/i);
    expect(link).toBeInTheDocument();
    expect(link.closest("a")).toHaveAttribute("href", "/coach/history");
  });
});
