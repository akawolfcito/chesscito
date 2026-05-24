import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";
import enMessages from "@/lib/content/messages/en";

const TEST_WALLET = "0x000000000000000000000000000000000000abcd";
const SHOP_ADDRESS = "0x0000000000000000000000000000000000005a4e";

const useAccountMock = vi.hoisted(() =>
  vi.fn(() => ({ address: TEST_WALLET, isConnected: true })),
);
const useChainIdMock = vi.hoisted(() => vi.fn(() => 42220));
const usePublicClientMock = vi.hoisted(() => vi.fn(() => ({}) as object));
const useReadContractsMock = vi.hoisted(() =>
  vi.fn(() => ({
    data: undefined as
      | undefined
      | { result?: bigint; status?: string }[],
  })),
);
const writeContractAsyncMock = vi.hoisted(() => vi.fn());
const useWriteContractMock = vi.hoisted(() =>
  vi.fn(() => ({ writeContractAsync: writeContractAsyncMock })),
);
const switchChainMock = vi.hoisted(() => vi.fn());
const useSwitchChainMock = vi.hoisted(() =>
  vi.fn(() => ({ switchChain: switchChainMock })),
);
const openConnectModalMock = vi.hoisted(() => vi.fn());
const refetchProStatusMock = vi.hoisted(() => vi.fn());
const useProStatusMock = vi.hoisted(() =>
  vi.fn(() => ({
    status: null as { active: boolean; expiresAt: number | null } | null,
    isLoading: false,
    refetch: refetchProStatusMock,
  })),
);
const trackMock = vi.hoisted(() => vi.fn());
const hapticSuccessMock = vi.hoisted(() => vi.fn());
const executeProPurchaseMock = vi.hoisted(() => vi.fn());

vi.mock("wagmi", () => ({
  useAccount: () => useAccountMock(),
  useChainId: () => useChainIdMock(),
  usePublicClient: () => usePublicClientMock(),
  useReadContracts: () => useReadContractsMock(),
  useSwitchChain: () => useSwitchChainMock(),
  useWriteContract: () => useWriteContractMock(),
}));

vi.mock("@rainbow-me/rainbowkit", () => ({
  useConnectModal: () => ({ openConnectModal: openConnectModalMock }),
}));

vi.mock("@/lib/pro/use-pro-status", () => ({
  useProStatus: () => useProStatusMock(),
}));

vi.mock("@/lib/pro/purchase", () => ({
  executeProPurchase: (...args: unknown[]) => executeProPurchaseMock(...args),
}));

vi.mock("@/lib/contracts/chains", () => ({
  getConfiguredChainId: () => 42220,
  getShopAddress: () => SHOP_ADDRESS,
}));

vi.mock("@/lib/telemetry", () => ({
  track: (...args: unknown[]) => trackMock(...args),
}));

vi.mock("@/lib/haptics", () => ({
  hapticSuccess: () => hapticSuccessMock(),
}));

import { useProSheetState } from "../use-pro-sheet-state";

/** Wraps `renderHook` with the next-intl provider so the hook's
 *  internal `useTranslations("PRO_COPY")` call resolves successfully.
 *  EN bundle is sufficient — these tests assert behavior, not copy. */
const IntlWrapper = ({ children }: { children: ReactNode }) => (
  <NextIntlClientProvider
    locale="en"
    messages={enMessages as Record<string, unknown>}
    onError={() => {}}
    getMessageFallback={({ key, namespace }) =>
      namespace ? `${namespace}.${key}` : key
    }
  >
    {children}
  </NextIntlClientProvider>
);
IntlWrapper.displayName = "IntlWrapper";

function renderProSheetHook() {
  return renderHook(() => useProSheetState(), { wrapper: IntlWrapper });
}

/** Token balances large enough to clear the cheapest stablecoin tier so
 *  `selectPaymentToken(PRO_PRICE_USD6)` resolves to a non-null token in
 *  the success / verify-failed tests. */
function withSufficientBalances() {
  useReadContractsMock.mockReturnValue({
    data: [
      // ACCEPTED_TOKENS entries — assume 6 decimals, balance 1_000 USD6
      { result: 1_000_000_000n, status: "success" },
      { result: 1_000_000_000n, status: "success" },
      { result: 1_000_000_000n, status: "success" },
      // CELO sibling — never used by PRO but read in the same batch
      { result: 0n, status: "success" },
    ],
  });
}

beforeEach(() => {
  useAccountMock.mockReset();
  useChainIdMock.mockReset();
  usePublicClientMock.mockReset();
  useReadContractsMock.mockReset();
  writeContractAsyncMock.mockReset();
  useWriteContractMock.mockReset();
  switchChainMock.mockReset();
  useSwitchChainMock.mockReset();
  openConnectModalMock.mockReset();
  refetchProStatusMock.mockReset();
  useProStatusMock.mockReset();
  trackMock.mockReset();
  hapticSuccessMock.mockReset();
  executeProPurchaseMock.mockReset();

  useAccountMock.mockReturnValue({ address: TEST_WALLET, isConnected: true });
  useChainIdMock.mockReturnValue(42220);
  usePublicClientMock.mockReturnValue({} as object);
  useReadContractsMock.mockReturnValue({ data: undefined });
  useWriteContractMock.mockReturnValue({
    writeContractAsync: writeContractAsyncMock,
  });
  useSwitchChainMock.mockReturnValue({ switchChain: switchChainMock });
  useProStatusMock.mockReturnValue({
    status: null,
    isLoading: false,
    refetch: refetchProStatusMock,
  });

  vi.stubGlobal("fetch", vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("useProSheetState — open/close lifecycle", () => {
  it("starts closed; openSheet flips open=true on sheetProps", () => {
    const { result } = renderProSheetHook();
    expect(result.current.open).toBe(false);
    expect(result.current.sheetProps.open).toBe(false);

    act(() => {
      result.current.openSheet();
    });

    expect(result.current.open).toBe(true);
    expect(result.current.sheetProps.open).toBe(true);
  });

  it("closeSheet while idle clears the sheet + resets error/verify state", async () => {
    withSufficientBalances();
    executeProPurchaseMock.mockResolvedValueOnce({
      kind: "verify-failed",
      txHash: "0xfeedface",
    });

    const { result } = renderProSheetHook();

    act(() => {
      result.current.openSheet();
    });
    await act(async () => {
      await result.current.sheetProps.onPurchase();
    });

    expect(result.current.sheetProps.verifyFailedTxHash).toBe("0xfeedface");
    expect(result.current.sheetProps.errorMessage).not.toBeNull();

    act(() => {
      result.current.closeSheet();
    });

    expect(result.current.open).toBe(false);
    expect(result.current.sheetProps.errorMessage).toBeNull();
    expect(result.current.sheetProps.verifyFailedTxHash).toBeNull();
  });
});

describe("useProSheetState — handlePurchase", () => {
  it("returns early without firing pro_purchase_started when balances are insufficient (no-token)", async () => {
    // tokenBalances=undefined → selectPaymentToken returns null → no-token.
    const { result } = renderProSheetHook();

    await act(async () => {
      await result.current.sheetProps.onPurchase();
    });

    expect(trackMock).toHaveBeenCalledWith("pro_purchase_failed", {
      kind: "no-token",
    });
    // pro_purchase_started must NOT fire for the no-token preview branch —
    // the lookahead exists precisely to keep the funnel clean.
    expect(
      trackMock.mock.calls.find((c) => c[0] === "pro_purchase_started"),
    ).toBeUndefined();
    expect(result.current.sheetProps.errorMessage).toBe(
      "Insufficient stablecoin balance.",
    );
    expect(executeProPurchaseMock).not.toHaveBeenCalled();
  });

  it("on success: closes sheet, refetches PRO status, fires haptic + confirmed event", async () => {
    withSufficientBalances();
    executeProPurchaseMock.mockResolvedValueOnce({
      kind: "success",
      txHash: "0xabcdef0123456789",
      expiresAt: Date.now() + 30 * 86_400_000,
    });

    const { result } = renderProSheetHook();

    act(() => {
      result.current.openSheet();
    });
    await act(async () => {
      await result.current.sheetProps.onPurchase();
    });

    expect(result.current.open).toBe(false);
    expect(refetchProStatusMock).toHaveBeenCalledTimes(1);
    expect(hapticSuccessMock).toHaveBeenCalledTimes(1);
    expect(trackMock).toHaveBeenCalledWith(
      "pro_purchase_confirmed",
      expect.objectContaining({ tx_hash_prefix: "0xabcdef01" }),
    );
  });

  it("on verify-failed: keeps sheet open, sets verifyFailedTxHash + errorMessage, surfaces retry CTA", async () => {
    withSufficientBalances();
    executeProPurchaseMock.mockResolvedValueOnce({
      kind: "verify-failed",
      txHash: "0xverifyhash",
    });

    const { result } = renderProSheetHook();

    act(() => {
      result.current.openSheet();
    });
    await act(async () => {
      await result.current.sheetProps.onPurchase();
    });

    expect(result.current.open).toBe(true);
    expect(result.current.sheetProps.verifyFailedTxHash).toBe("0xverifyhash");
    expect(result.current.sheetProps.errorMessage).not.toBeNull();
    expect(trackMock).toHaveBeenCalledWith(
      "pro_purchase_failed",
      expect.objectContaining({ kind: "verify-failed" }),
    );
  });
});

describe("useProSheetState — handleRetryVerify", () => {
  it("on /api/verify-pro 200 + active=true: closes sheet, clears state, refetches", async () => {
    withSufficientBalances();
    executeProPurchaseMock.mockResolvedValueOnce({
      kind: "verify-failed",
      txHash: "0xretryhash",
    });
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ active: true }),
    });

    const { result } = renderProSheetHook();

    act(() => {
      result.current.openSheet();
    });
    await act(async () => {
      await result.current.sheetProps.onPurchase();
    });
    expect(result.current.sheetProps.verifyFailedTxHash).toBe("0xretryhash");

    await act(async () => {
      result.current.sheetProps.onRetryVerify?.();
    });

    await waitFor(() => {
      expect(result.current.open).toBe(false);
    });
    expect(result.current.sheetProps.verifyFailedTxHash).toBeNull();
    expect(result.current.sheetProps.errorMessage).toBeNull();
    expect(refetchProStatusMock).toHaveBeenCalled();
  });

  it("on /api/verify-pro non-active response: keeps state intact + fires retry-failed telemetry", async () => {
    withSufficientBalances();
    executeProPurchaseMock.mockResolvedValueOnce({
      kind: "verify-failed",
      txHash: "0xretryhash2",
    });
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ active: false }),
    });

    const { result } = renderProSheetHook();

    act(() => {
      result.current.openSheet();
    });
    await act(async () => {
      await result.current.sheetProps.onPurchase();
    });

    await act(async () => {
      result.current.sheetProps.onRetryVerify?.();
    });

    await waitFor(() => {
      expect(result.current.sheetProps.isRetryingVerify).toBe(false);
    });
    expect(result.current.sheetProps.verifyFailedTxHash).toBe("0xretryhash2");
    expect(result.current.sheetProps.errorMessage).not.toBeNull();
    expect(trackMock).toHaveBeenCalledWith(
      "pro_verify_retry_failed",
      expect.objectContaining({
        tx_hash_prefix: "0xretryhas",
        status: 200,
      }),
    );
  });
});
