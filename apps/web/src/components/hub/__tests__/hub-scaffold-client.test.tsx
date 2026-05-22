import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const pushMock = vi.hoisted(() => vi.fn());

const useAccountMock = vi.hoisted(() =>
  vi.fn(
    () =>
      ({ address: undefined, isConnected: false }) as {
        address: string | undefined;
        isConnected: boolean;
      },
  ),
);
const openConnectModalMock = vi.hoisted(() => vi.fn());
const trackMock = vi.hoisted(() => vi.fn());
const useChainIdMock = vi.hoisted(() => vi.fn(() => 42220));
const useReadContractsMock = vi.hoisted(() =>
  vi.fn(() => ({
    data: undefined as
      | undefined
      | { result?: boolean | unknown; status?: string }[],
  })),
);
const useProStatusMock = vi.hoisted(() =>
  vi.fn(() => ({
    status: null as
      | { active: boolean; expiresAt: number | null }
      | null,
    isLoading: false,
    refetch: vi.fn(),
  })),
);

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
  usePathname: () => "/hub",
}));

vi.mock("wagmi", () => ({
  useAccount: () => useAccountMock(),
  useChainId: () => useChainIdMock(),
  useReadContracts: () => useReadContractsMock(),
  // The PRO + Shop sheet hooks fan out to several wagmi hooks; stub
  // them here so the scaffold can mount without errors. The actual
  // behavior is covered by `use-pro-sheet-state.test.tsx` and
  // `use-shop-sheet-state.test.tsx`.
  useReadContract: () => ({ data: 0n }),
  useWaitForTransactionReceipt: () => ({
    isLoading: false,
    isSuccess: false,
  }),
  usePublicClient: () => ({}),
  useWriteContract: () => ({ writeContractAsync: vi.fn(), isPending: false }),
  useSwitchChain: () => ({ switchChain: vi.fn() }),
}));

// `useMiniPay` is consumed by `useShopSheetState` for the CELO sibling
// branch. Default to "not in MiniPay" — covers ~99% of the test surface.
vi.mock("@/hooks/use-minipay", () => ({
  useMiniPay: () => ({ hasProvider: false, isMiniPay: false, isReady: true }),
}));

// Shop hook also imports `shopAbi` and `shop-catalog` constants; stub the
// ABI to keep the import graph cheap. The catalog constants resolve from
// the real module — they're plain bigints with no side effects.
vi.mock("@/lib/contracts/shop", () => ({ shopAbi: [] as const }));

// Transaction helpers + errors used inside the shop hook's purchase
// path. Tap-handler tests never reach the purchase flow, so no-ops are
// fine.
vi.mock("@/lib/contracts/transaction-helpers", () => ({
  waitForReceiptWithTimeout: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/errors", () => ({
  classifyTxError: () => "error",
  isTransactionTimeout: () => false,
  isUserCancellation: () => false,
}));

// Shield-event bus used by the shop hook + scaffold. Both the dispatch
// and subscribe sides are stubbed; the scaffold's listener never fires
// in unit tests, so a no-op unsubscribe is sufficient.
vi.mock("@/lib/shop/shield-events", () => ({
  dispatchShieldChange: vi.fn(),
  subscribeToShieldChanges: () => () => {},
}));

vi.mock("@rainbow-me/rainbowkit", () => ({
  useConnectModal: () => ({ openConnectModal: openConnectModalMock }),
}));

// SPEC 1 Task 5.5 wired `<ProfileSheet>` and `useClaimQueue` into the
// scaffold. ProfileSheet pulls in wagmi.useDisconnect + the wallet
// provider's wagmiConfig (via claims/sources). The unit tests below
// never assert on Profile UI or claim queue internals — stub both so
// the import graph stays cheap. Behavior is covered by
// `profile-sheet.test.tsx` and `use-claim-queue.test.tsx`.
vi.mock("@/components/profile/profile-sheet", () => ({
  ProfileSheet: () => null,
}));

vi.mock("@/hooks/use-claim-queue", () => ({
  useClaimQueue: () => ({
    claims: [],
    isLoading: false,
    isClaiming: false,
    inFlight: new Set<string>(),
    error: null,
    claim: vi.fn(),
  }),
}));

vi.mock("@/lib/telemetry", () => ({
  track: (...args: unknown[]) => trackMock(...args),
}));

vi.mock("@/lib/pro/use-pro-status", () => ({
  useProStatus: () => useProStatusMock(),
}));

// `executeProPurchase` would otherwise pull viem + the shop ABI through
// the live module graph. The hook orchestrates around it; tap-handler
// tests never trigger a purchase, so a no-op stub is sufficient.
vi.mock("@/lib/pro/purchase", () => ({
  executeProPurchase: vi.fn(),
}));

vi.mock("@/lib/contracts/chains", () => ({
  // Stable, non-null address keeps `useReadContracts` "enabled" branch
  // exercised when a wallet is provided. PRO + Badge sheet hooks pull
  // additional helpers from this module, so all four are stubbed.
  getBadgesAddress: () => "0xBadgesContractAddress00000000000000000000",
  getShopAddress: () => "0xShopContractAddress00000000000000000000aa",
  getConfiguredChainId: () => 42220,
  getMiniPayFeeCurrency: () => undefined,
}));

vi.mock("@/lib/contracts/badges", () => ({
  badgesAbi: [] as const,
}));

vi.mock("@/lib/contracts/scoreboard", () => ({
  // Badge sheet hook reads getLevelId(piece) when claiming. The hub
  // scaffold tests never trigger a claim, but the import must resolve.
  getLevelId: () => 0n,
}));

import { HubScaffoldClient } from "../hub-scaffold-client";

const TEST_WALLET = "0x000000000000000000000000000000000000abcd";

function setBadges(claimed: boolean[]) {
  useReadContractsMock.mockReturnValue({
    data: claimed.map((v) => ({ result: v, status: "success" })),
  });
}

beforeEach(() => {
  pushMock.mockReset();
  useAccountMock.mockReset();
  useChainIdMock.mockReset();
  useReadContractsMock.mockReset();
  useProStatusMock.mockReset();

  useAccountMock.mockReturnValue({ address: undefined, isConnected: false });
  openConnectModalMock.mockReset();
  trackMock.mockReset();
  useChainIdMock.mockReturnValue(42220);
  useReadContractsMock.mockReturnValue({ data: undefined });
  useProStatusMock.mockReturnValue({
    status: null,
    isLoading: false,
    refetch: vi.fn(),
  });
  localStorage.clear();
});

afterEach(() => {
  cleanup();
});

describe("HubScaffoldClient — trophies", () => {
  it("renders 0 trophies when no wallet is connected", () => {
    render(<HubScaffoldClient />);

    // Trophy chip aria comes from HUD_COPY.trophiesAriaLabel(count).
    expect(screen.getByLabelText("Trophies: 0")).toBeInTheDocument();
  });

  it("counts on-chain claimed badges as trophies", () => {
    useAccountMock.mockReturnValue({ address: TEST_WALLET, isConnected: true });
    setBadges([true, true, false, false, true, false]);

    render(<HubScaffoldClient />);

    expect(screen.getByLabelText("Trophies: 3")).toBeInTheDocument();
  });
});

describe("HubScaffoldClient — PRO chip", () => {
  it("collapses the PRO chip when status is null and surfaces the inactive PremiumSlot", () => {
    render(<HubScaffoldClient />);

    // HudResourceChip(tone="pro", value=null) returns null by contract.
    // Assert by the chip's active-state text pattern ("PRO 7d") instead
    // of bare "PRO" so the new right-rail PRO discovery tile (which
    // always renders the "PRO" label) doesn't collide with this guard.
    expect(screen.queryByText(/^PRO \d+d$/)).not.toBeInTheDocument();
    // The legacy inactive Coach PRO card ("Train with Coach" CTA) was
    // removed in the PRO-discoverability refactor; the PRO chip
    // collapse + Go PRO absence remain the canonical guards.
    expect(screen.queryByText("Go PRO")).not.toBeInTheDocument();
  });

  it("renders PRO active with rounded-up days remaining when expiresAt is in the future", () => {
    const ms = 7 * 86_400_000 + 1; // ~7.0 days from now (just over)
    useAccountMock.mockReturnValue({ address: TEST_WALLET, isConnected: true });
    useProStatusMock.mockReturnValue({
      status: { active: true, expiresAt: Date.now() + ms },
      isLoading: false,
      refetch: vi.fn(),
    });

    render(<HubScaffoldClient />);

    // Either "PRO active, 7 days remaining" or 8 (ceil); accept both
    // adjacent integers to absorb tiny clock drift between component
    // and test reads of Date.now().
    const chip =
      screen.queryByLabelText("PRO active, 7 days remaining") ??
      screen.queryByLabelText("PRO active, 8 days remaining");
    expect(chip).not.toBeNull();
  });

  it("treats an expired PRO status as inactive (chip collapses)", () => {
    useAccountMock.mockReturnValue({ address: TEST_WALLET, isConnected: true });
    useProStatusMock.mockReturnValue({
      status: { active: true, expiresAt: Date.now() - 1000 },
      isLoading: false,
      refetch: vi.fn(),
    });

    render(<HubScaffoldClient />);

    // Chip collapses to null; the removed "Train with Coach" CTA is no
    // longer the inactive surface — the new flow is the PRO HUD chip
    // tap + dock pathway, covered below. Match on the active chip's
    // text pattern so the new right-rail PRO tile (label "PRO") does
    // not interfere with this collapse check.
    expect(screen.queryByText(/^PRO \d+d$/)).not.toBeInTheDocument();
  });
});

describe("HubScaffoldClient — PRO discovery panel", () => {
  it("renders the PRO discovery panel on first paint when the subscription is inactive", () => {
    render(<HubScaffoldClient />);

    const panel = screen.getByLabelText(
      /Unlock PRO subscription — unlock the full experience\./,
    );
    expect(panel).toBeInTheDocument();
  });

  it("opens ProSheet when the discovery panel is tapped (inactive)", async () => {
    const user = userEvent.setup();
    render(<HubScaffoldClient />);

    const panel = screen.getByLabelText(
      /Unlock PRO subscription — unlock the full experience\./,
    );
    await user.click(panel);

    expect(await screen.findByTestId("pro-kicker")).toBeInTheDocument();
    expect(trackMock).toHaveBeenCalledWith("hub_pro_tile_tap", {
      pro_active: false,
    });
  });

  it("unmounts the discovery panel when PRO is active (HUD chip is the only recognition surface)", () => {
    useAccountMock.mockReturnValue({ address: TEST_WALLET, isConnected: true });
    useProStatusMock.mockReturnValue({
      status: { active: true, expiresAt: Date.now() + 7 * 86_400_000 },
      isLoading: false,
      refetch: vi.fn(),
    });

    render(<HubScaffoldClient />);

    // Panel hides when active — avoids duplicating recognition with the
    // HUD chip ("PRO 7d"), which stays as the canonical active-state cue.
    expect(
      screen.queryByLabelText(
        /Unlock PRO subscription — unlock the full experience\./,
      ),
    ).not.toBeInTheDocument();
    // HUD chip continues to surface the active days remaining.
    expect(
      screen.queryByLabelText(/PRO active, 7 days remaining/) ??
        screen.queryByLabelText(/PRO active, 8 days remaining/),
    ).not.toBeNull();
  });
});

describe("HubScaffoldClient — tap handlers", () => {
  it("routes to /trophies directly when the trophy chip is tapped (port 2026-05-07)", async () => {
    const user = userEvent.setup();
    render(<HubScaffoldClient />);

    await user.click(screen.getByLabelText("Trophies: 0"));

    // /trophies route restored 2026-05-07 — direct nav, no bounce.
    expect(pushMock).toHaveBeenCalledWith("/trophies");
  });

  it("opens ProSheet in-place (no navigation) when the PRO chip (active) is tapped", async () => {
    const user = userEvent.setup();
    useAccountMock.mockReturnValue({ address: TEST_WALLET, isConnected: true });
    useProStatusMock.mockReturnValue({
      status: { active: true, expiresAt: Date.now() + 7 * 86_400_000 },
      isLoading: false,
      refetch: vi.fn(),
    });
    render(<HubScaffoldClient />);

    const chip =
      screen.queryByLabelText("PRO active, 7 days remaining") ??
      screen.getByLabelText("PRO active, 8 days remaining");
    await user.click(chip);

    // Port 2026-05-07: PRO sheet renders directly above the scaffold;
    // the legacy `?legacy=1&action=pro` round-trip is gone — and with
    // it the bounce that hid "Play in Arena" behind the legacy dock.
    // Sheet content is rendered via Radix portal once open.
    expect(await screen.findByTestId("pro-kicker")).toBeInTheDocument();
    expect(pushMock).not.toHaveBeenCalledWith(
      expect.stringContaining("legacy=1&action=pro"),
    );
  });

  // The legacy "Train with Coach" / "Open Journal" CTAs on the Coach
  // PRO card were removed in the PRO-discoverability refactor. The
  // ProSheet open path is now exercised by the PRO HUD chip tap test
  // above, and the active-PRO route to /coach/history is exercised via
  // the dock pathway (see hub-scaffold-client telemetry block).

  it("opens ProSheet from the `initialSheet=pro` deep link", async () => {
    render(<HubScaffoldClient initialSheet="pro" />);

    expect(await screen.findByTestId("pro-kicker")).toBeInTheDocument();
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("routes to /arena when the SecondaryCta (Enter Arena) fires (SPEC 1 D5)", async () => {
    const user = userEvent.setup();
    render(<HubScaffoldClient />);

    await user.click(screen.getByLabelText("Enter Arena — full chess vs AI"));

    // Spec D5: Arena is the *calm* secondary action under the
    // contextual Hero CTA. No more `?fresh=1` — /arena now defaults to
    // the selector on direct visits (the auto-launch shortcut moved
    // under `?arena=legacy`). Hero CTA owns the contextual routing
    // (e.g. `/exercises?slot=daily` when daily is pending).
    expect(pushMock).toHaveBeenCalledWith("/arena");
  });

  it("keeps the shields shop affordance hidden while the Hub visual pass is active", () => {
    localStorage.setItem("chesscito:shields:credited-cache", "2");
    localStorage.setItem("chesscito:shields:consumed", "0");
    render(<HubScaffoldClient />);

    expect(
      screen.queryByRole("button", { name: /streak shields available/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByLabelText(/streak shields available/i),
    ).not.toBeInTheDocument();
    expect(pushMock).not.toHaveBeenCalledWith(
      expect.stringContaining("legacy=1"),
    );
  });

  it("routes queen reward tile directly to its exercises piece page", async () => {
    const user = userEvent.setup();
    localStorage.setItem(
      "chesscito:progress:queen",
      JSON.stringify({ piece: "queen", exerciseIndex: 0, stars: [3, 3, 3, 3, 0] }),
    );
    useAccountMock.mockReturnValue({ address: TEST_WALLET, isConnected: true });
    setBadges([true, true, false, false, false, false]);
    render(<HubScaffoldClient />);

    await user.click(
      await screen.findByRole("button", { name: /claim queen mastery badge/i }),
    );

    expect(pushMock).toHaveBeenCalledWith("/exercises?piece=queen");
  });

  it("routes unlocked reward tile taps directly to their exercises piece page", async () => {
    const user = userEvent.setup();
    localStorage.setItem(
      "chesscito:progress:rook",
      JSON.stringify({ piece: "rook", exerciseIndex: 0, stars: [3, 3, 3, 3, 0] }),
    );
    render(<HubScaffoldClient />);

    await user.click(
      await screen.findByRole("button", { name: /claim rook mastery badge/i }),
    );

    expect(pushMock).toHaveBeenCalledWith("/exercises?piece=rook");
  });

  it("does not route locked reward tile taps until the piece is unlocked", async () => {
    const user = userEvent.setup();
    render(<HubScaffoldClient />);

    await user.click(
      await screen.findByRole("button", { name: /bishop mastery.*locked/i }),
    );

    expect(pushMock).not.toHaveBeenCalledWith(
      expect.stringContaining("/exercises?piece=bishop"),
    );
  });
});

describe("HubScaffoldClient — connect affordance", () => {
  it("renders the Connect chip when no wallet is connected", () => {
    render(<HubScaffoldClient />);

    expect(
      screen.getByLabelText("Connect wallet to see your stats"),
    ).toBeInTheDocument();
  });

  it("hides the Connect chip when a wallet is connected", () => {
    useAccountMock.mockReturnValue({ address: TEST_WALLET, isConnected: true });
    render(<HubScaffoldClient />);

    expect(
      screen.queryByLabelText("Connect wallet to see your stats"),
    ).not.toBeInTheDocument();
  });

  it("opens the RainbowKit connect modal when the Connect chip is tapped", async () => {
    const user = userEvent.setup();
    render(<HubScaffoldClient />);

    await user.click(
      screen.getByLabelText("Connect wallet to see your stats"),
    );

    expect(openConnectModalMock).toHaveBeenCalledTimes(1);
  });
});

describe("HubScaffoldClient — shields chip", () => {
  it("does not render the shields chip by default", () => {
    render(<HubScaffoldClient />);

    expect(
      screen.queryByLabelText(/streak shields available/i),
    ).not.toBeInTheDocument();
  });

  it("stays hidden even when a credited-cache value exists", () => {
    localStorage.setItem("chesscito:shields:credited-cache", "5");
    localStorage.setItem("chesscito:shields:consumed", "0");
    render(<HubScaffoldClient />);

    expect(
      screen.queryByLabelText(/streak shields available/i),
    ).not.toBeInTheDocument();
  });
});

describe("HubScaffoldClient — telemetry", () => {
  it("fires hub_view once on mount", () => {
    render(<HubScaffoldClient />);
    expect(trackMock).toHaveBeenCalledWith("hub_view");
  });

  it("fires pro_training_card_viewed for the Hub Coach card", () => {
    render(<HubScaffoldClient />);

    expect(trackMock).toHaveBeenCalledWith("pro_training_card_viewed", {
      surface: "hub",
      pro_active: false,
      wallet_connected: false,
      cta: "open_pro_sheet",
    });
  });

  // pro_training_card_cta_tap was wired to the "Train with Coach" /
  // "Open Journal" buttons on the Coach PRO card. The card was removed
  // in the PRO-discoverability refactor; the CTA tap event no longer
  // has a source surface. The pro_training_card_viewed view event
  // continues to fire (covered above).

  it("fires hub_trophy_tap with the current trophy count on tap", async () => {
    const user = userEvent.setup();
    useAccountMock.mockReturnValue({ address: TEST_WALLET, isConnected: true });
    setBadges([true, true, false, false, false, false]);
    render(<HubScaffoldClient />);

    await user.click(screen.getByLabelText("Trophies: 2"));

    expect(trackMock).toHaveBeenCalledWith("hub_trophy_tap", { count: 2 });
  });

  it("fires hub_pro_chip_tap with pro_active=true when active and chip is tapped", async () => {
    const user = userEvent.setup();
    useAccountMock.mockReturnValue({ address: TEST_WALLET, isConnected: true });
    useProStatusMock.mockReturnValue({
      status: { active: true, expiresAt: Date.now() + 7 * 86_400_000 },
      isLoading: false,
      refetch: vi.fn(),
    });
    render(<HubScaffoldClient />);

    const chip =
      screen.queryByLabelText("PRO active, 7 days remaining") ??
      screen.getByLabelText("PRO active, 8 days remaining");
    await user.click(chip);

    expect(trackMock).toHaveBeenCalledWith("hub_pro_chip_tap", {
      pro_active: true,
    });
  });

  it("does not render the inactive PremiumSlot conversion CTA while the training card is active", () => {
    render(<HubScaffoldClient />);

    expect(screen.queryByText("Go PRO")).not.toBeInTheDocument();
    expect(trackMock).not.toHaveBeenCalledWith(
      "hub_premium_slot_tap",
      expect.anything(),
    );
  });

  it("does not fire hub_shields_chip_tap while the shields chip is hidden", () => {
    localStorage.setItem("chesscito:shields:credited-cache", "3");
    localStorage.setItem("chesscito:shields:consumed", "0");
    render(<HubScaffoldClient />);

    expect(
      screen.queryByRole("button", { name: /streak shields available/i }),
    ).not.toBeInTheDocument();
    expect(trackMock).not.toHaveBeenCalledWith(
      "hub_shields_chip_tap",
      expect.anything(),
    );
  });

  it("fires secondary_arena_clicked on SecondaryCta press", async () => {
    const user = userEvent.setup();
    render(<HubScaffoldClient />);

    await user.click(screen.getByLabelText("Enter Arena — full chess vs AI"));

    // Replaces the legacy `hub_play_tap` event — the primary play CTA
    // is now the contextual Hero (fires `hero_cta_clicked`), and the
    // secondary Arena link has its own dedicated event.
    expect(trackMock).toHaveBeenCalledWith("secondary_arena_clicked");
  });

  it("fires hub_connect_chip_tap before opening the modal", async () => {
    const user = userEvent.setup();
    render(<HubScaffoldClient />);

    await user.click(
      screen.getByLabelText("Connect wallet to see your stats"),
    );

    expect(trackMock).toHaveBeenCalledWith("hub_connect_chip_tap");
    // Order matters — telemetry must precede the side-effect.
    const trackOrder = trackMock.mock.invocationCallOrder[
      trackMock.mock.calls.findIndex((c) => c[0] === "hub_connect_chip_tap")
    ];
    const modalOrder = openConnectModalMock.mock.invocationCallOrder[0];
    expect(trackOrder).toBeLessThan(modalOrder);
  });

  it("fires hub_reward_tile_tap with piece + state when a reward tile is tapped", async () => {
    const user = userEvent.setup();
    localStorage.setItem(
      "chesscito:progress:rook",
      JSON.stringify({ piece: "rook", exerciseIndex: 0, stars: [3, 3, 3, 3, 0] }),
    );
    render(<HubScaffoldClient />);

    await user.click(
      await screen.findByRole("button", { name: /claim rook mastery badge/i }),
    );

    expect(pushMock).toHaveBeenCalledWith("/exercises?piece=rook");
    expect(trackMock).toHaveBeenCalledWith("hub_reward_tile_tap", {
      piece: "rook",
      state: "claimable",
    });
  });
});
