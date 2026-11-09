import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithIntl as render } from "@/test-utils/render-with-intl";
import { act, waitFor } from "@testing-library/react";

import { dispatchDailyCompleted } from "@/lib/daily/events";

/**
 * The write is wired HERE, next to the read it has to move.
 *
 * Without this container mounting the recorder, Stage 2 in production is a card
 * that seeds a backfill and then never moves again: the player completes the
 * Daily and the number stays put for the whole season. That was the blocker on
 * pushing `main`, so it gets an assertion on the real container, not on the
 * hook in isolation.
 */

const WALLET = "0x00000000000000000000000000000000000000ab";

vi.mock("next/dynamic", () => ({ default: () => () => null }));
vi.mock("@/i18n/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/lib/telemetry", () => ({ track: vi.fn() }));
vi.mock("@/lib/feature-flags", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/feature-flags")>()),
  CHESSCITO_LITE_MODE: true,
}));

vi.mock("wagmi", () => ({
  useAccount: () => ({ address: WALLET, isConnected: true, status: "connected" }),
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
// A paying player with hydrated progress and NO local day pending, so the only
// request under test is the one the completion causes.
vi.mock("@/components/hub/use-hub-data", () => ({
  useHubData: () => ({
    shared: {
      address: WALLET,
      isConnected: true,
      trophies: 0,
      badgesClaimed: {},
      starsPerPiece: {},
      completedPerPiece: {},
      shieldCount: 0,
      hero: null,
    },
    lite: {
      focusPassport: {
        streak: 2,
        totalCompleted: 2,
        todayDone: false,
        isLoading: false,
        lastCompletedDate: null,
      },
      contentLoop: { action: null, isHydrated: true, primaryPiece: "rook" },
      sessionQuota: { isAtFreeLimit: false, isAtHardMax: false },
      seasonPass: {
        active: true,
        source: "season_pass",
        loading: false,
        seasonPassExpiresAt: "2026-05-10T00:00:00.000Z",
        refresh: vi.fn(),
      },
      challengeSeasonPass: { active: true, isLoading: false },
      challenge: { durationDays: 21, shieldBonus: 3, priceLabel: "$1.99" },
    },
  }),
}));
vi.mock("@/components/profile/profile-sheet", () => ({ ProfileSheet: () => null }));
vi.mock("@/components/hub/hub-daily-tile", () => ({ HubDailyTile: () => null }));
vi.mock("@/components/hub/hub-lite-scaffold", () => ({
  HubLiteScaffold: ({ dailySlot }: { dailySlot: ReactNode }) => <div>{dailySlot}</div>,
}));

import { LearnHubClient } from "../learn-hub-client";

function urlsOf(fetchMock: ReturnType<typeof vi.fn>): string[] {
  return fetchMock.mock.calls.map((call) => String(call[0]));
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  let completed = 4;
  fetchMock = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
    if (String(url).startsWith("/api/focus-day")) {
      completed += 1;
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({ ok: true, progress: { completed, goal: 21 } }),
      });
    }
    void init;
    return Promise.resolve({
      ok: true,
      status: 200,
      json: async () => ({
        focusDays: { status: "ok", completed, goal: 21, seasonId: "s1" },
      }),
    });
  });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("LearnHubClient — Focus Days write", () => {
  it("POSTs the completed day and then re-counts, so the card can move", async () => {
    render(<LearnHubClient />);
    await waitFor(() => expect(urlsOf(fetchMock).some((u) => u.includes("/status"))).toBe(true));
    const readsBefore = urlsOf(fetchMock).filter((u) => u.includes("/status")).length;

    act(() => dispatchDailyCompleted("2026-04-25"));

    await waitFor(() =>
      expect(urlsOf(fetchMock).filter((u) => u === "/api/focus-day")).toHaveLength(1),
    );
    // The count is a second call, and it lands after the write: without the
    // re-read the number would stay frozen until the next mount.
    await waitFor(() =>
      expect(urlsOf(fetchMock).filter((u) => u.includes("/status")).length).toBeGreaterThan(
        readsBefore,
      ),
    );
  });
});
