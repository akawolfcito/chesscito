import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useMintVictory } from "../use-mint-victory";

const mocks = vi.hoisted(() => ({ write: vi.fn(), sign: vi.fn(), read: vi.fn(), fetch: vi.fn(), receipt: vi.fn() }));
const wallet = `0x${"1".repeat(40)}` as const;
const nft = `0x${"2".repeat(40)}` as const;
const fee = `0x${"3".repeat(40)}` as const;
vi.mock("wagmi", () => ({
  useAccount: () => ({ address: `0x${"1".repeat(40)}`, isConnected: true }),
  useChainId: () => 42220,
  usePublicClient: () => ({ readContract: mocks.read }),
  useReadContracts: () => ({ data: [{ status: "success", result: 1_000_000_000_000_000_000n }] }),
  useWriteContract: () => ({ writeContractAsync: mocks.write }),
  useSignTypedData: () => ({ signTypedDataAsync: mocks.sign }),
}));
vi.mock("@/lib/contracts/chains", () => ({
  getConfiguredChainId: () => 42220,
  getVictoryNFTAddress: () => `0x${"2".repeat(40)}`,
  getMiniPayFeeCurrency: () => `0x${"3".repeat(40)}`,
}));
vi.mock("@/lib/minipay", () => ({ isMiniPayEnv: () => true }));
vi.mock("@/lib/feature-flags", () => ({ isVictoryPermitMintEnabled: () => true }));
vi.mock("@/lib/contracts/transaction-helpers", () => ({
  waitForReceiptWithTimeout: (...args: unknown[]) => mocks.receipt(...args),
  assertReceiptSuccess: (_hash: string, receipt: unknown) => receipt,
}));
vi.mock("next-intl", () => ({ useTranslations: () => (key: string) => key }));

beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
  mocks.write.mockResolvedValue(`0x${"a".repeat(64)}`);
  mocks.read.mockResolvedValue(1_000_000_000_000_000_000n);
  mocks.receipt.mockResolvedValue({ status: "success", logs: [] });
  mocks.fetch.mockResolvedValue({ ok: true, json: async () => ({ nonce: "1", deadline: String(Math.floor(Date.now() / 1000) + 300), signature: `0x${"a".repeat(130)}` }) });
  vi.stubGlobal("fetch", mocks.fetch);
});

afterEach(() => vi.unstubAllGlobals());

describe("MiniPay victory mint compatibility", () => {
  it.each([false, true])("uses transactions rather than message signatures; approval needed: %s", async (approval) => {
    mocks.read.mockResolvedValue(approval ? 0n : 1_000_000_000_000_000_000n);
    const { result } = renderHook(() => useMintVictory({
      walletAddress: wallet, result: "win", difficulty: "easy", elapsedMs: 10_000,
      moveHistory: ["f3", "e5", "g4", "Qh4#"],
    }));
    await act(async () => { await result.current.start(); });
    expect(result.current.phase).toBe("success");
    expect(mocks.sign).not.toHaveBeenCalled();
    expect(mocks.write.mock.calls.map(([request]) => request.functionName)).toEqual(approval ? ["approve", "mintSigned"] : ["mintSigned"]);
    for (const [request] of mocks.write.mock.calls) expect(request).toEqual(expect.objectContaining({ account: wallet, chainId: 42220, feeCurrency: fee }));
    expect(mocks.write.mock.calls.at(-1)?.[0].address).toBe(nft);
  });
});
