import { describe, it, expect, vi } from "vitest";
import { renderWithIntl as render, screen } from "@/test-utils/render-with-intl";

/**
 * Regression: Full path without a configured victories contract.
 *
 * The fix `if (!configured && !CHESSCITO_LITE_MODE)` must preserve the
 * legacy "Trophies are offline" fallback for Full builds when the contract
 * address is not configured. Lite Achievements must NOT bleed into the
 * Full path.
 */

// Feature flag: Full mode.
vi.mock("@/lib/feature-flags", () => ({ CHESSCITO_LITE_MODE: false }));

// No victories contract configured.
vi.mock("@/lib/game/victory-events", () => ({
  getVictoryAddress: () => null,
}));

vi.mock("wagmi", () => ({
  useAccount: () => ({ address: undefined, isConnected: false }),
}));

vi.mock("@/lib/wallet/use-connect-wallet", () => ({
  useConnectWallet: () => ({ connectWallet: vi.fn(), isConnecting: false }),
}));

vi.mock("@/components/trophies/trophies-data-provider", () => ({
  useTrophiesData: () => ({
    victories: [],
    loading: false,
    error: null,
    reload: vi.fn(),
  }),
  clearOptimisticVictory: vi.fn(),
  getOptimisticVictory: vi.fn(() => null),
  toVictoryEntry: vi.fn(),
}));

vi.mock("@/lib/coach/use-coach-history-count", () => ({
  useCoachHistoryCount: () => ({ rowCount: 0, isLoading: false, refetch: vi.fn() }),
}));

import { TrophiesBody } from "../trophies-body";

// ---------------------------------------------------------------------------
// Full without victories contract — legacy fallback must survive the fix
// ---------------------------------------------------------------------------
describe("TrophiesBody — Full without victories contract", () => {
  it("shows the legacy 'Trophies are offline' fallback", () => {
    render(<TrophiesBody />);
    expect(screen.getByText("Trophies are offline")).toBeInTheDocument();
  });

  it("does NOT render Lite achievement titles", () => {
    render(<TrophiesBody />);
    expect(screen.queryByText("First Focus Day")).not.toBeInTheDocument();
    expect(screen.queryByText("3-Day Rhythm")).not.toBeInTheDocument();
    expect(screen.queryByText("7-Day Focus")).not.toBeInTheDocument();
  });
});
