import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

const useAccountMock = vi.hoisted(() => vi.fn());
const useChainIdMock = vi.hoisted(() => vi.fn());
vi.mock("wagmi", () => ({
  useAccount: useAccountMock,
  useChainId: useChainIdMock,
  usePublicClient: () => ({ waitForTransactionReceipt: vi.fn() }),
  useWriteContract: () => ({ writeContractAsync: vi.fn() }),
}));
vi.mock("@/lib/wallet/use-connect-wallet", () => ({
  useConnectWallet: () => ({ connectWallet: vi.fn(), isConnecting: false }),
}));

import { RailSmokeClient } from "../rail-smoke-client";

const TREASURY = "0x1234567890abcdef1234567890abcdef12345678";
const WALLET = "0xaaaabbbbccccddddeeeeffff0000111122223333";

beforeEach(() => {
  useAccountMock.mockReturnValue({ address: undefined, isConnected: false });
  useChainIdMock.mockReturnValue(42220);
});
afterEach(() => {
  delete process.env.NEXT_PUBLIC_CHESSCITO_TREASURY_ADDRESS;
  vi.restoreAllMocks();
});

describe("RailSmokeClient — fail-closed gate", () => {
  it("treasury unset → 'Rail not configured', no pay button", () => {
    delete process.env.NEXT_PUBLIC_CHESSCITO_TREASURY_ADDRESS;
    render(<RailSmokeClient />);
    expect(screen.getByText(/Rail not configured/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Pay .* no approve/i })).not.toBeInTheDocument();
  });
});

describe("RailSmokeClient — configured states", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_CHESSCITO_TREASURY_ADDRESS = TREASURY;
  });

  it("not connected → Connect wallet", () => {
    render(<RailSmokeClient />);
    expect(screen.getByRole("button", { name: /Connect wallet/i })).toBeInTheDocument();
    // Shows the pack/treasury details (sku appears in the heading + the dl).
    expect(screen.getAllByText(/peones_pack_50/).length).toBeGreaterThan(0);
    expect(screen.getByText(TREASURY)).toBeInTheDocument();
  });

  it("connected on wrong chain → prompts to switch to Celo", () => {
    useAccountMock.mockReturnValue({ address: WALLET, isConnected: true });
    useChainIdMock.mockReturnValue(1);
    render(<RailSmokeClient />);
    expect(screen.getByText(/Switch your wallet to Celo/i)).toBeInTheDocument();
  });

  it("connected on Celo mainnet → shows the one-tap pay button", () => {
    useAccountMock.mockReturnValue({ address: WALLET, isConnected: true });
    useChainIdMock.mockReturnValue(42220);
    render(<RailSmokeClient />);
    expect(
      screen.getByRole("button", { name: /Pay 0\.50 USDC \(1 tx, no approve\)/i }),
    ).toBeInTheDocument();
  });
});
