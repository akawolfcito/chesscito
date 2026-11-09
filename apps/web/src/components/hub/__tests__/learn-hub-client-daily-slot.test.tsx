import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithIntl as render } from "@/test-utils/render-with-intl";
import { screen } from "@testing-library/react";
import { fireEvent } from "@testing-library/react";

/**
 * The Learn hub's daily is CONTROLLED by this container: the corner gift and
 * the Focus Passport flame must open ONE mounted `HubDailyTile`, not two.
 *
 * That used to be a fact about `HubLiteScaffold` (it owned `dailyOpen` and
 * mounted the tile), and it was asserted there. The scaffold now takes the
 * daily as a `dailySlot: ReactNode` so it can mount without a wagmi provider
 * (`HubDailyTile` calls `useAccount()`), which moves the invariant here —
 * this file is where it survives the move.
 */

const dailyRenders = vi.hoisted(() => [] as boolean[]);

vi.mock("next/dynamic", () => ({ default: () => () => null }));
vi.mock("@/i18n/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/lib/telemetry", () => ({ track: vi.fn() }));
vi.mock("@/lib/feature-flags", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/feature-flags")>()),
  CHESSCITO_LITE_MODE: true,
}));

// ── Hook surface (all read-only for this assertion) ─────────────────────────
vi.mock("wagmi", () => ({
  useAccount: () => ({ address: undefined, isConnected: false, status: "disconnected" }),
}));
vi.mock("@/lib/wallet/use-connect-wallet", () => ({
  useConnectWallet: () => ({ connectWallet: vi.fn() }),
}));
vi.mock("@/lib/peones/use-peones-balance", () => ({
  usePeonesBalance: () => ({ state: { kind: "guest" }, refetch: vi.fn() }),
}));
vi.mock("@/lib/pro/use-pro-sheet-state", () => ({
  useProSheetState: () => ({ openSheet: vi.fn(), proStatus: null, sheetProps: {} }),
}));
vi.mock("@/lib/pro/use-is-pro-active", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/pro/use-is-pro-active")>()),
  useProEntitlement: () => ({ isPro: false, isLoading: false, source: null }),
}));
vi.mock("@/lib/badges/use-badge-sheet-state", () => ({
  useBadgeSheetState: () => ({ openSheet: vi.fn(), sheetProps: {} }),
}));
vi.mock("@/lib/shop/use-shop-sheet-state", () => ({
  useShopSheetState: () => ({ openSheet: vi.fn(), sheetProps: {}, confirmProps: {} }),
}));
vi.mock("@/hooks/use-claim-queue", () => ({ useClaimQueue: vi.fn() }));
vi.mock("@/lib/shop/use-shield-sync", () => ({ useShieldSync: vi.fn() }));
vi.mock("@/lib/content/catalog-context", () => ({ useLabyrinthCatalog: () => [] }));
vi.mock("@/lib/progression/use-milestone-seeding", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/progression/use-milestone-seeding")>()),
  useMilestoneSeeding: vi.fn(),
}));
vi.mock("@/components/hub/use-hub-tour", () => ({
  useHubTour: () => ({ isOpen: false, steps: [], start: vi.fn(), close: vi.fn(), replay: vi.fn() }),
}));
vi.mock("@/components/hub/use-hub-data", () => ({
  useHubData: () => ({
    shared: {
      address: undefined,
      isConnected: false,
      trophies: 0,
      badgesClaimed: {},
      starsPerPiece: {},
      completedPerPiece: {},
      shieldCount: 0,
      hero: null,
    },
    lite: {
      focusPassport: { streak: 2, totalCompleted: 2, todayDone: false, isLoading: false },
      contentLoop: { action: null, isHydrated: true, primaryPiece: "rook" },
      sessionQuota: { isAtFreeLimit: false, isAtHardMax: false },
      seasonPass: { active: false, source: null, loading: false, refresh: vi.fn() },
      challengeSeasonPass: { active: false, isLoading: false },
      challenge: { durationDays: 21, shieldBonus: 3, priceLabel: "$1.99" },
    },
  }),
}));

// Sibling sheets the container always mounts (closed). They carry their own
// wagmi/contract hooks and have their own suites; none of them is the daily.
vi.mock("@/components/profile/profile-sheet", () => ({ ProfileSheet: () => null }));

// The daily records every `open` it is rendered with, so a SECOND instance
// would show up as a second entry per render pass — not just a wrong flag.
vi.mock("@/components/hub/hub-daily-tile", () => ({
  HubDailyTile: ({ open }: { open?: boolean }) => {
    dailyRenders.push(Boolean(open));
    return <button type="button" data-testid="daily" data-open={Boolean(open)} />;
  },
}));

// Stub the presenter down to the two things this test is about.
vi.mock("@/components/hub/hub-lite-scaffold", () => ({
  HubLiteScaffold: ({
    dailySlot,
    onPassportTap,
  }: {
    dailySlot: ReactNode;
    onPassportTap: () => void;
  }) => (
    <div>
      {dailySlot}
      <button type="button" data-testid="passport" onClick={onPassportTap} />
    </div>
  ),
}));

import { LearnHubClient } from "../learn-hub-client";

describe("LearnHubClient — daily slot", () => {
  beforeEach(() => {
    dailyRenders.length = 0;
  });

  it("hands the scaffold one controlled Daily and opens THAT one from the Focus Passport", () => {
    render(<LearnHubClient />);

    // One instance, closed.
    expect(screen.getAllByTestId("daily")).toHaveLength(1);
    expect(screen.getByTestId("daily")).toHaveAttribute("data-open", "false");
    expect(dailyRenders).toEqual([false]);

    fireEvent.click(screen.getByTestId("passport"));

    // Still one instance — and it is the one that opened. A second mounted
    // tile would satisfy "something is open" while the gift stayed shut.
    expect(screen.getAllByTestId("daily")).toHaveLength(1);
    expect(screen.getByTestId("daily")).toHaveAttribute("data-open", "true");
    expect(dailyRenders).toEqual([false, true]);
  });
});
