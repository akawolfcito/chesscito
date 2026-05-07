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
}));

vi.mock("wagmi", () => ({
  useAccount: () => useAccountMock(),
  useChainId: () => useChainIdMock(),
  useReadContracts: () => useReadContractsMock(),
}));

vi.mock("@rainbow-me/rainbowkit", () => ({
  useConnectModal: () => ({ openConnectModal: openConnectModalMock }),
}));

vi.mock("@/lib/telemetry", () => ({
  track: (...args: unknown[]) => trackMock(...args),
}));

vi.mock("@/lib/pro/use-pro-status", () => ({
  useProStatus: () => useProStatusMock(),
}));

vi.mock("@/lib/contracts/chains", () => ({
  // Stable, non-null address keeps `useReadContracts` "enabled" branch
  // exercised when a wallet is provided.
  getBadgesAddress: () => "0xBadgesContractAddress00000000000000000000",
}));

vi.mock("@/lib/contracts/badges", () => ({
  badgesAbi: [] as const,
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
    expect(screen.queryByText("PRO")).not.toBeInTheDocument();
    // PremiumSlot inactive CTA carries the upgrade path instead.
    expect(screen.getByText("Go PRO")).toBeInTheDocument();
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

    expect(screen.queryByText("PRO")).not.toBeInTheDocument();
    expect(screen.getByText("Go PRO")).toBeInTheDocument();
  });
});

describe("HubScaffoldClient — tap handlers", () => {
  it("routes to /hub?legacy=1&action=trophies when the trophy chip is tapped", async () => {
    const user = userEvent.setup();
    render(<HubScaffoldClient />);

    await user.click(screen.getByLabelText("Trophies: 0"));

    // The standalone /trophies route was removed in commit 9c907f6 —
    // <TrophiesSheet> is now the only path. Deep-link via legacy.
    expect(pushMock).toHaveBeenCalledWith("/hub?legacy=1&action=trophies");
  });

  it("routes to /hub?legacy=1&action=pro when the PRO chip (active) is tapped", async () => {
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

    expect(pushMock).toHaveBeenCalledWith("/hub?legacy=1&action=pro");
  });

  it("routes to /hub?legacy=1&action=pro when the inactive PremiumSlot CTA is tapped", async () => {
    const user = userEvent.setup();
    render(<HubScaffoldClient />);

    await user.click(screen.getByText("Go PRO"));

    expect(pushMock).toHaveBeenCalledWith("/hub?legacy=1&action=pro");
  });

  it("routes to /arena directly when the primary PLAY CTA fires (B5 fix 2026-05-07)", async () => {
    const user = userEvent.setup();
    render(<HubScaffoldClient />);

    await user.click(screen.getByLabelText("Start training"));

    expect(pushMock).toHaveBeenCalledWith("/arena");
  });

  it("routes to /hub?legacy=1&action=shop when the shields chip is tapped", async () => {
    const user = userEvent.setup();
    localStorage.setItem("chesscito:shields", "2");
    render(<HubScaffoldClient />);

    // Shields chip is part of the secondary HUD row.
    await user.click(
      await screen.findByRole("button", { name: /retry shields available/i }),
    );

    expect(pushMock).toHaveBeenCalledWith("/hub?legacy=1&action=shop");
  });

  it("drops the piece query for tiles whose piece has no shippable exercises (queen)", async () => {
    const user = userEvent.setup();
    // Make queen "claimable" — but queen has no exercises (EXERCISES.queen=[]),
    // so the deep link must NOT carry &piece=queen lest the legacy board
    // crash on mount.
    localStorage.setItem(
      "chesscito:progress:queen",
      JSON.stringify({ piece: "queen", exerciseIndex: 0, stars: [3, 3, 3, 3, 0] }),
    );
    // Master rook + bishop on-chain so queen's prerequisite chain is
    // satisfied (otherwise the queen tile would render as `locked`).
    useAccountMock.mockReturnValue({ address: TEST_WALLET, isConnected: true });
    setBadges([true, true, false, false, false, false]);
    render(<HubScaffoldClient />);

    await user.click(
      await screen.findByRole("button", { name: /claim queen mastery badge/i }),
    );

    expect(pushMock).toHaveBeenCalledWith("/hub?legacy=1&action=badges");
  });

  it("routes to /hub?legacy=1&piece={id}&action=badges when a reward tile is tapped", async () => {
    const user = userEvent.setup();
    // Bring rook to "claimable" state — full stars threshold met, badge
    // not yet claimed on-chain.
    localStorage.setItem(
      "chesscito:progress:rook",
      JSON.stringify({ piece: "rook", exerciseIndex: 0, stars: [3, 3, 3, 3, 0] }),
    );
    render(<HubScaffoldClient />);

    // RewardColumn renders tiles as buttons with REWARD_COPY aria.
    await user.click(
      await screen.findByRole("button", { name: /claim rook mastery badge/i }),
    );

    expect(pushMock).toHaveBeenCalledWith(
      "/hub?legacy=1&action=badges&piece=rook",
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
  it("renders shields=0 by default (depleted state is the strongest replenishment cue)", () => {
    render(<HubScaffoldClient />);

    expect(
      screen.getByLabelText(/0 retry shields available/i),
    ).toBeInTheDocument();
  });

  it("reads shield count from localStorage on mount", async () => {
    localStorage.setItem("chesscito:shields", "5");
    render(<HubScaffoldClient />);

    expect(
      await screen.findByLabelText(/5 retry shields available/i),
    ).toBeInTheDocument();
  });

  it("falls back to 0 when localStorage value is corrupt", () => {
    localStorage.setItem("chesscito:shields", "not-a-number");
    render(<HubScaffoldClient />);

    expect(
      screen.getByLabelText(/0 retry shields available/i),
    ).toBeInTheDocument();
  });
});

describe("HubScaffoldClient — telemetry", () => {
  it("fires hub_view once on mount", () => {
    render(<HubScaffoldClient />);
    expect(trackMock).toHaveBeenCalledWith("hub_view");
  });

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

  it("fires hub_premium_slot_tap with pro_active=false when inactive slot is tapped", async () => {
    const user = userEvent.setup();
    render(<HubScaffoldClient />);

    await user.click(screen.getByText("Go PRO"));

    expect(trackMock).toHaveBeenCalledWith("hub_premium_slot_tap", {
      pro_active: false,
    });
  });

  it("fires hub_shields_chip_tap with the current shield_count (KEY conversion event)", async () => {
    const user = userEvent.setup();
    localStorage.setItem("chesscito:shields", "3");
    render(<HubScaffoldClient />);

    await user.click(
      await screen.findByRole("button", { name: /3 retry shields available/i }),
    );

    expect(trackMock).toHaveBeenCalledWith("hub_shields_chip_tap", {
      shield_count: 3,
    });
  });

  it("fires hub_play_tap on PLAY CTA press", async () => {
    const user = userEvent.setup();
    render(<HubScaffoldClient />);

    await user.click(screen.getByLabelText("Start training"));

    expect(trackMock).toHaveBeenCalledWith("hub_play_tap");
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

    expect(trackMock).toHaveBeenCalledWith("hub_reward_tile_tap", {
      piece: "rook",
      state: "claimable",
    });
  });
});
