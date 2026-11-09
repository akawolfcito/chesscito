import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const useAccountMock = vi.hoisted(() => vi.fn());
const useChainIdMock = vi.hoisted(() => vi.fn());
const useReadContractsMock = vi.hoisted(() => vi.fn());
vi.mock("wagmi", () => ({
  useAccount: useAccountMock,
  useChainId: useChainIdMock,
  useReadContracts: useReadContractsMock,
}));

import { act, renderHook } from "@testing-library/react";
import {
  selectPayableToken,
  useGetPeonesTokenSelection,
  type TokenBalanceInput,
} from "@/lib/payments/use-get-peones-token-selection";

const PRICE = 500_000n; // $0.50
const A = "0x0000000000000000000000000000000000000000";
const bal = (symbol: string, decimals: number, balance: bigint): TokenBalanceInput => ({
  symbol,
  address: A,
  decimals,
  balance,
});

const SUFFICIENT_6 = 500_000n;
const SUFFICIENT_18 = 500_000n * 10n ** 12n;

describe("selectPayableToken (pure)", () => {
  it("auto-selects USDC when it has enough", () => {
    const { autoSelected } = selectPayableToken(PRICE, [
      bal("USDC", 6, SUFFICIENT_6),
      bal("USDT", 6, SUFFICIENT_6),
      bal("cUSD", 18, SUFFICIENT_18),
    ]);
    expect(autoSelected).toBe("USDC");
  });

  it("falls back to USDT when USDC is insufficient", () => {
    const { autoSelected } = selectPayableToken(PRICE, [
      bal("USDC", 6, 0n),
      bal("USDT", 6, SUFFICIENT_6),
      bal("cUSD", 18, 0n),
    ]);
    expect(autoSelected).toBe("USDT");
  });

  it("falls back to cUSD when USDC and USDT are insufficient", () => {
    const { autoSelected } = selectPayableToken(PRICE, [
      bal("USDC", 6, 0n),
      bal("USDT", 6, 1n),
      bal("cUSD", 18, SUFFICIENT_18),
    ]);
    expect(autoSelected).toBe("cUSD");
  });

  it("returns null when no token can pay", () => {
    const { autoSelected } = selectPayableToken(PRICE, [
      bal("USDC", 6, 0n),
      bal("USDT", 6, 0n),
      bal("cUSD", 18, 0n),
    ]);
    expect(autoSelected).toBeNull();
  });

  it("normalizes the required amount by decimals", () => {
    const { tokens } = selectPayableToken(PRICE, [
      bal("USDC", 6, SUFFICIENT_6),
      bal("cUSD", 18, SUFFICIENT_18),
    ]);
    expect(tokens.find((t) => t.symbol === "USDC")?.expectedAmount).toBe(500_000n);
    expect(tokens.find((t) => t.symbol === "cUSD")?.expectedAmount).toBe(500_000n * 10n ** 12n);
  });

  it("orders tokens by preference (USDC, USDT, cUSD)", () => {
    const { tokens } = selectPayableToken(PRICE, [
      bal("cUSD", 18, 0n),
      bal("USDT", 6, 0n),
      bal("USDC", 6, 0n),
    ]);
    expect(tokens.map((t) => t.symbol)).toEqual(["USDC", "USDT", "cUSD"]);
  });
});

describe("useGetPeonesTokenSelection (hook)", () => {
  const WALLET = "0xaaaabbbbccccddddeeeeffff0000111122223333";
  beforeEach(() => {
    useAccountMock.mockReturnValue({ address: WALLET });
    useChainIdMock.mockReturnValue(42220);
  });
  afterEach(() => vi.restoreAllMocks());

  /** RAIL_ACCEPTED_STABLECOINS order is [USDC, USDT, cUSD]. */
  function setBalances(usdc: bigint, usdt: bigint, cusd: bigint, isLoading = false) {
    useReadContractsMock.mockReturnValue({
      data: [
        { status: "success", result: usdc },
        { status: "success", result: usdt },
        { status: "success", result: cusd },
      ],
      isLoading,
    });
  }

  it("manual override to a payable token is used", () => {
    setBalances(SUFFICIENT_6, SUFFICIENT_6, SUFFICIENT_18);
    const { result } = renderHook(() => useGetPeonesTokenSelection("peones_pack_50"));
    expect(result.current.selectedSymbol).toBe("USDC"); // auto
    act(() => result.current.setSelectedSymbol("cUSD"));
    expect(result.current.selectedSymbol).toBe("cUSD");
    expect(result.current.selected?.payable).toBe(true);
  });

  it("manual override to an insufficient token → selected not payable", () => {
    setBalances(0n, SUFFICIENT_6, 0n); // only USDT payable; auto = USDT
    const { result } = renderHook(() => useGetPeonesTokenSelection("peones_pack_50"));
    expect(result.current.selectedSymbol).toBe("USDT");
    act(() => result.current.setSelectedSymbol("USDC"));
    expect(result.current.selectedSymbol).toBe("USDC");
    expect(result.current.selected?.payable).toBe(false);
  });

  it("no payable token → noPayableToken true", () => {
    setBalances(0n, 0n, 0n);
    const { result } = renderHook(() => useGetPeonesTokenSelection("peones_pack_50"));
    expect(result.current.selectedSymbol).toBeNull();
    expect(result.current.noPayableToken).toBe(true);
  });

  it("failed/empty balance reads are fail-safe (0, no crash)", () => {
    useReadContractsMock.mockReturnValue({
      data: [{ status: "failure" }, undefined, { status: "failure" }],
      isLoading: false,
    });
    const { result } = renderHook(() => useGetPeonesTokenSelection("peones_pack_50"));
    expect(result.current.noPayableToken).toBe(true);
    expect(result.current.tokens.every((t) => t.balance === 0n)).toBe(true);
  });
});
