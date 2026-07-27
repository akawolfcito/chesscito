import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithIntl as render } from "@/test-utils/render-with-intl";
import { screen, waitFor } from "@testing-library/react";

/**
 * AC20 — the REAL path, end to end.
 *
 * Every other test in this cluster hands the card a `ChallengeProgressView` it
 * built by hand, which proves the card renders what it is given and nothing
 * about whether anything gives it that. This one starts at the `/status`
 * response and lets the production wiring carry it: provider →
 * `resolveEffectiveTrainingPass` → `use-hub-data` → `buildChallengeProgressView`
 * → `ChallengeCard`.
 *
 * The only things faked are the network and the chain.
 */

const WALLET = "0x00000000000000000000000000000000000000ab";
const STORAGE_KEY = "chesscito:daily-progress";

vi.mock("next/dynamic", () => ({ default: () => () => null }));
vi.mock("@/i18n/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/",
  Link: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
}));
vi.mock("@/lib/telemetry", () => ({ track: vi.fn() }));
vi.mock("@/lib/feature-flags", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/feature-flags")>()),
  CHESSCITO_MODE: "learn",
  CHESSCITO_LITE_MODE: true,
}));

// The chain, stubbed at the edge. `use-hub-data` itself stays real: it is the
// unit under test as much as the card is.
vi.mock("wagmi", () => ({
  useAccount: () => ({ address: WALLET, isConnected: true, status: "connected" }),
  useChainId: () => 42220,
  useReadContracts: () => ({ data: undefined, isLoading: false }),
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
  useIsProActive: () => false,
  useProEntitlement: () => ({
    status: "inactive",
    active: false,
    loading: false,
    expiresAt: null,
    stale: null,
    error: null,
  }),
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
vi.mock("@/components/profile/profile-sheet", () => ({ ProfileSheet: () => null }));
vi.mock("@/components/hub/hub-daily-tile", () => ({ HubDailyTile: () => null }));

// AC18 — the shields counter, spied by name. The other three crediting paths
// are network calls and are caught by the URL assertions below.
const shieldWrites = vi.hoisted(() => ({ count: 0 }));
vi.mock("@/lib/shop/shield-storage", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/shop/shield-storage")>();
  return {
    ...actual,
    writeCreditedCache: (n: number) => {
      shieldWrites.count += 1;
      return actual.writeCreditedCache(n);
    },
  };
});

import { EffectiveTrainingPassProvider } from "@/lib/season-pass/use-season-pass-status";
import { LearnHubClient } from "../learn-hub-client";

/** One `/status` body, served to every caller of that route. */
function serveStatus(body: Record<string, unknown>) {
  const fetchMock = vi.fn().mockImplementation((url: string) => {
    if (String(url).includes("/api/season-pass/status")) {
      return Promise.resolve({ ok: true, status: 200, json: async () => body });
    }
    // Any other route (focus-day writes included) answers harmlessly.
    return Promise.resolve({ ok: true, status: 200, json: async () => ({ ok: true }) });
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function renderHub() {
  return render(
    <EffectiveTrainingPassProvider>
      <LearnHubClient />
    </EffectiveTrainingPassProvider>,
  );
}

beforeEach(() => {
  shieldWrites.count = 0;
  // A hydrated local Daily, so the LEARN read is allowed to fire at all.
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ streak: 2, lastCompletedDate: null, totalCompleted: 2 }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe("Focus Days — from the /status response to the card", () => {
  it("an expiring pass renders recorded progress AND days left", async () => {
    serveStatus({
      active: true,
      source: "season_pass",
      seasonPassExpiresAt: new Date(Date.now() + 18 * 86_400_000).toISOString(),
      proExpiresAt: null,
      shieldsCredited: 3,
      focusDays: { status: "ok", completed: 3, goal: 21, seasonId: "s1" },
    });

    renderHub();

    const card = await screen.findByTestId("challenge-card");
    await waitFor(() => expect(card).toHaveAttribute("data-progress-state", "active"));
    expect(screen.getByTestId("challenge-progress-line")).toHaveTextContent("3 of 21 Focus Days");
    // The window is a SECOND metric, not the same number worded differently.
    expect(screen.getByTestId("challenge-window")).toHaveTextContent(/day/);
  });

  it("PRO renders unbounded access and NO countdown", async () => {
    serveStatus({
      active: true,
      source: "pro",
      seasonPassExpiresAt: null,
      // Epoch ms, NOT an ISO string: the status validator rejects the whole
      // body otherwise, and the card silently falls back to the offer.
      proExpiresAt: Date.now() + 300 * 86_400_000,
      focusDays: { status: "ok", completed: 6, goal: 21, seasonId: "s1" },
    });

    renderHub();

    const card = await screen.findByTestId("challenge-card");
    await waitFor(() => expect(card).toHaveAttribute("data-progress-state", "active"));
    expect(screen.getByTestId("challenge-progress-line")).toHaveTextContent("6 of 21 Focus Days");
    // PRO reaches the challenge with no purchased window, so the countdown
    // element is absent and the badge says why. The assertion that matters is
    // still the one about `left`: a countdown for a subscriber who bought no
    // window can only be wrong, and now it cannot render at all.
    expect(screen.queryByTestId("challenge-window")).toBeNull();
    expect(screen.getByTestId("challenge-active-badge")).toHaveTextContent(/included/i);
  });

  it("a response with no ledger slice degrades the card, and says so", async () => {
    serveStatus({
      active: true,
      source: "season_pass",
      seasonPassExpiresAt: new Date(Date.now() + 10 * 86_400_000).toISOString(),
      proExpiresAt: null,
      shieldsCredited: 3,
    });

    renderHub();

    const card = await screen.findByTestId("challenge-card");
    await waitFor(() => expect(card).toHaveAttribute("data-progress-state", "degraded"));
    // No number, and the streak (2, in localStorage) must NOT stand in for one.
    expect(screen.queryByTestId("challenge-progress-line")).toBeNull();
    expect(screen.getByTestId("challenge-progress-unavailable")).toBeInTheDocument();
    // Access is untouched: a degraded ledger is not a lost pass.
    expect(screen.getByTestId("challenge-window")).toBeInTheDocument();
  });
});

/**
 * AC18 — reaching the goal pays NOTHING.
 *
 * The guardrail is explicit in the spec: this ledger records a habit, it does
 * not mint value. A reward wired in later has to be a decision someone makes on
 * purpose, not something that appears because 21 rows exist.
 *
 * The four paths are spied BY NAME: Peones spend/credit, the shields counter,
 * Coach credits, and any write of `expires_at` (which reaches the client only
 * through the payment/verification routes).
 */
describe("Focus Days — reaching 21 credits nothing", () => {
  const CREDITING_ROUTES = [
    "/api/peones/spend",
    "/api/peones/earn",
    "/api/shields",
    "/api/coach",
    "/api/verify-payment",
    "/api/payment-intents",
  ];

  it("renders the completed card and touches none of the four crediting paths", async () => {
    const fetchMock = serveStatus({
      active: true,
      source: "season_pass",
      seasonPassExpiresAt: new Date(Date.now() + 3 * 86_400_000).toISOString(),
      proExpiresAt: null,
      shieldsCredited: 3,
      focusDays: { status: "ok", completed: 21, goal: 21, seasonId: "s1" },
    });

    renderHub();

    const card = await screen.findByTestId("challenge-card");
    await waitFor(() => expect(card).toHaveAttribute("data-progress-state", "completed"));
    expect(screen.getByTestId("challenge-progress-line")).toHaveTextContent("21 of 21 Focus Days");

    const requested = fetchMock.mock.calls.map((call) => String(call[0]));
    for (const route of CREDITING_ROUTES) {
      expect(requested.filter((url) => url.startsWith(route))).toEqual([]);
    }
    expect(shieldWrites.count).toBe(0);
  });
});
