import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const pushMock = vi.hoisted(() => vi.fn());

const useAccountMock = vi.hoisted(() =>
  vi.fn(() => ({ address: undefined as string | undefined })),
);
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

  useAccountMock.mockReturnValue({ address: undefined });
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
    useAccountMock.mockReturnValue({ address: TEST_WALLET });
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
    useAccountMock.mockReturnValue({ address: TEST_WALLET });
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
    useAccountMock.mockReturnValue({ address: TEST_WALLET });
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
  it("routes to /trophies when the trophy chip is tapped", async () => {
    const user = userEvent.setup();
    render(<HubScaffoldClient />);

    await user.click(screen.getByLabelText("Trophies: 0"));

    expect(pushMock).toHaveBeenCalledWith("/trophies");
  });

  it("routes to /hub when the PRO chip (active) is tapped", async () => {
    const user = userEvent.setup();
    useAccountMock.mockReturnValue({ address: TEST_WALLET });
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

    expect(pushMock).toHaveBeenCalledWith("/hub");
  });

  it("routes to /hub when the inactive PremiumSlot CTA is tapped", async () => {
    const user = userEvent.setup();
    render(<HubScaffoldClient />);

    await user.click(screen.getByText("Go PRO"));

    expect(pushMock).toHaveBeenCalledWith("/hub");
  });

  it("routes to /hub when the primary PLAY CTA fires", async () => {
    const user = userEvent.setup();
    render(<HubScaffoldClient />);

    await user.click(screen.getByLabelText("Start training"));

    expect(pushMock).toHaveBeenCalledWith("/hub");
  });
});
