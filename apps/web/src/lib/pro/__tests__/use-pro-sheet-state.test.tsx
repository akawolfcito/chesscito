import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";
import enMessages from "@/lib/content/messages/en";

const TEST_WALLET = "0x000000000000000000000000000000000000abcd";
const TREASURY = "0x1234567890abcdef1234567890abcdef12345678";
const USDC = "0xcebA9300f2b948710d2653dD7B07f33A8B32118C";
const HASH = `0x${"a".repeat(64)}` as const;

const useAccountMock = vi.hoisted(() =>
  vi.fn(() => ({ address: TEST_WALLET, isConnected: true })),
);
const useChainIdMock = vi.hoisted(() => vi.fn(() => 42220));
const waitReceiptMock = vi.hoisted(() => vi.fn());
const usePublicClientMock = vi.hoisted(() =>
  vi.fn(() => ({ waitForTransactionReceipt: waitReceiptMock })),
);
const useReadContractsMock = vi.hoisted(() =>
  vi.fn(() => ({
    data: undefined as
      | undefined
      | { result?: bigint; status?: string }[],
    isLoading: false,
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
const connectWalletMock = vi.hoisted(() => vi.fn());
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
const usePathnameMock = vi.hoisted(() => vi.fn<() => string | null>(() => "/"));

vi.mock("wagmi", () => ({
  useAccount: () => useAccountMock(),
  useChainId: () => useChainIdMock(),
  usePublicClient: () => usePublicClientMock(),
  useReadContracts: () => useReadContractsMock(),
  useSwitchChain: () => useSwitchChainMock(),
  useWriteContract: () => useWriteContractMock(),
}));

vi.mock("@/lib/wallet/use-connect-wallet", () => ({
  useConnectWallet: () => ({ connectWallet: connectWalletMock, isConnecting: false }),
}));

vi.mock("@/lib/pro/use-pro-status", () => ({
  useProStatus: () => useProStatusMock(),
}));

vi.mock("@/lib/contracts/chains", () => ({
  getConfiguredChainId: () => 42220,
  getShopAddress: () => "0x0000000000000000000000000000000000005a4e",
  getMiniPayFeeCurrency: () => undefined,
}));

vi.mock("@/lib/telemetry", () => ({
  track: (...args: unknown[]) => trackMock(...args),
}));

vi.mock("@/lib/haptics", () => ({
  hapticSuccess: () => hapticSuccessMock(),
}));

vi.mock("@/i18n/navigation", () => ({
  usePathname: () => usePathnameMock(),
}));

import { useProSheetState } from "../use-pro-sheet-state";

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

function renderProSheetHook(options?: Parameters<typeof useProSheetState>[0]) {
  return renderHook(() => useProSheetState(options), { wrapper: IntlWrapper });
}

function withSufficientBalances() {
  useReadContractsMock.mockReturnValue({
    data: [
      { result: 1_000_000_000n, status: "success" },
      { result: 1_000_000_000n, status: "success" },
      { result: 1_000_000_000n, status: "success" },
    ],
    isLoading: false,
  });
}

function mockFetchOk(body: Record<string, unknown>) {
  return vi.fn().mockResolvedValue({ json: () => Promise.resolve(body) });
}

beforeEach(() => {
  process.env.NEXT_PUBLIC_CHESSCITO_TREASURY_ADDRESS = TREASURY;
  useAccountMock.mockReset();
  useChainIdMock.mockReset();
  usePublicClientMock.mockReset();
  useReadContractsMock.mockReset();
  writeContractAsyncMock.mockReset();
  useWriteContractMock.mockReset();
  switchChainMock.mockReset();
  useSwitchChainMock.mockReset();
  connectWalletMock.mockReset();
  refetchProStatusMock.mockReset();
  useProStatusMock.mockReset();
  trackMock.mockReset();
  hapticSuccessMock.mockReset();
  waitReceiptMock.mockReset();
  usePathnameMock.mockReset();
  usePathnameMock.mockReturnValue("/");

  useAccountMock.mockReturnValue({ address: TEST_WALLET, isConnected: true });
  useChainIdMock.mockReturnValue(42220);
  usePublicClientMock.mockReturnValue({ waitForTransactionReceipt: waitReceiptMock });
  useReadContractsMock.mockReturnValue({ data: undefined, isLoading: false });
  useWriteContractMock.mockReturnValue({ writeContractAsync: writeContractAsyncMock });
  useSwitchChainMock.mockReturnValue({ switchChain: switchChainMock });
  useProStatusMock.mockReturnValue({
    status: null,
    isLoading: false,
    refetch: refetchProStatusMock,
  });
  writeContractAsyncMock.mockResolvedValue(HASH);
  waitReceiptMock.mockResolvedValue({ status: "success" });

  vi.stubGlobal("fetch", mockFetchOk({ ok: true, expiresAt: Date.now() + 30 * 86_400_000, token: USDC, amountPaid: "1990000", duplicate: false, overpaid: false }));
});

afterEach(() => {
  delete process.env.NEXT_PUBLIC_CHESSCITO_TREASURY_ADDRESS;
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
    vi.stubGlobal("fetch", mockFetchOk({ ok: false, error: "amount_too_low" }));

    const { result } = renderProSheetHook();

    act(() => {
      result.current.openSheet();
    });
    await act(async () => {
      await result.current.sheetProps.onPurchase();
    });

    expect(result.current.sheetProps.verifyFailedTxHash).toBe(HASH);
    expect(result.current.sheetProps.errorMessage).not.toBeNull();

    act(() => {
      result.current.closeSheet();
    });

    expect(result.current.open).toBe(false);
    expect(result.current.sheetProps.errorMessage).toBeNull();
    expect(result.current.sheetProps.verifyFailedTxHash).toBeNull();
  });
});

// Now that the Coach dock opens the Journal instead of the paywall, the only
// way to know whether that was a good idea is to see which SURFACE sold the
// pass. Entries into the journal are not purchases attributable to it — without
// this, a dip in PRO would have been unreadable: cause or cure, we couldn't
// tell. Attribution is by surface (pathname), not by CTA within a surface.
describe("useProSheetState — purchase attribution", () => {
  it("attributes the purchase to the surface that opened the sheet", async () => {
    withSufficientBalances();
    usePathnameMock.mockReturnValue("/coach/history");
    const { result } = renderProSheetHook();

    act(() => {
      result.current.openSheet();
    });
    await act(async () => {
      await result.current.sheetProps.onPurchase();
    });

    expect(trackMock).toHaveBeenCalledWith(
      "pro_purchase_started",
      expect.objectContaining({ source: "/coach/history" }),
    );
    expect(trackMock).toHaveBeenCalledWith(
      "pro_purchase_confirmed",
      expect.objectContaining({ source: "/coach/history" }),
    );
  });

  it("freezes the source at open, so navigating mid-purchase cannot rewrite it", async () => {
    withSufficientBalances();
    usePathnameMock.mockReturnValue("/coach/history");
    const { result, rerender } = renderProSheetHook();

    act(() => {
      result.current.openSheet();
    });

    // The player drifts elsewhere while the sheet is up. The sale still
    // belongs to the surface that made it.
    usePathnameMock.mockReturnValue("/");
    rerender();

    await act(async () => {
      await result.current.sheetProps.onPurchase();
    });

    expect(trackMock).toHaveBeenCalledWith(
      "pro_purchase_started",
      expect.objectContaining({ source: "/coach/history" }),
    );
  });
});

describe("useProSheetState — handlePurchase", () => {
  it("returns early without calling the rail when balances are insufficient (no-token)", async () => {
    const { result } = renderProSheetHook();

    await act(async () => {
      await result.current.sheetProps.onPurchase();
    });

    expect(trackMock).toHaveBeenCalledWith("pro_purchase_failed", { kind: "no-token" });
    expect(
      trackMock.mock.calls.find((c) => c[0] === "pro_purchase_started"),
    ).toBeUndefined();
    expect(result.current.sheetProps.errorMessage).toBe(
      "Insufficient stablecoin balance.",
    );
    expect(writeContractAsyncMock).not.toHaveBeenCalled();
  });

  it("on success: sends a direct transfer (no approve), closes sheet, refetches PRO status, fires haptic + confirmed event", async () => {
    withSufficientBalances();
    const { result } = renderProSheetHook();

    act(() => {
      result.current.openSheet();
    });
    await act(async () => {
      await result.current.sheetProps.onPurchase();
    });

    for (const c of writeContractAsyncMock.mock.calls) {
      expect(c[0].functionName).not.toBe("approve");
    }
    expect(writeContractAsyncMock).toHaveBeenCalledTimes(1);
    expect(result.current.open).toBe(false);
    expect(refetchProStatusMock).toHaveBeenCalledTimes(1);
    expect(hapticSuccessMock).toHaveBeenCalledTimes(1);
    expect(trackMock).toHaveBeenCalledWith(
      "pro_purchase_confirmed",
      expect.objectContaining({ days_granted: 30, tx_hash_prefix: HASH.slice(0, 10) }),
    );
  });

  it("on verify-failed: keeps sheet open, sets verifyFailedTxHash + errorMessage, surfaces retry CTA", async () => {
    withSufficientBalances();
    vi.stubGlobal("fetch", mockFetchOk({ ok: false, error: "amount_too_low" }));

    const { result } = renderProSheetHook();

    act(() => {
      result.current.openSheet();
    });
    await act(async () => {
      await result.current.sheetProps.onPurchase();
    });

    expect(result.current.open).toBe(true);
    expect(result.current.sheetProps.verifyFailedTxHash).toBe(HASH);
    expect(result.current.sheetProps.errorMessage).not.toBeNull();
    expect(trackMock).toHaveBeenCalledWith(
      "pro_purchase_failed",
      expect.objectContaining({ kind: "verify-failed" }),
    );
  });

  it("on user cancellation: stays silent — no errorMessage, no pro_purchase_failed", async () => {
    withSufficientBalances();
    writeContractAsyncMock.mockRejectedValueOnce(new Error("User rejected the request"));

    const { result } = renderProSheetHook();

    act(() => {
      result.current.openSheet();
    });
    await act(async () => {
      await result.current.sheetProps.onPurchase();
    });

    expect(result.current.open).toBe(true);
    expect(result.current.sheetProps.errorMessage).toBeNull();
    expect(
      trackMock.mock.calls.find((c) => c[0] === "pro_purchase_failed"),
    ).toBeUndefined();
  });
});

describe("useProSheetState — handleRetryVerify", () => {
  it("on retry success: closes sheet, clears state, refetches", async () => {
    withSufficientBalances();
    vi.stubGlobal("fetch", mockFetchOk({ ok: false, error: "amount_too_low" }));

    const { result } = renderProSheetHook();

    act(() => {
      result.current.openSheet();
    });
    await act(async () => {
      await result.current.sheetProps.onPurchase();
    });
    expect(result.current.sheetProps.verifyFailedTxHash).toBe(HASH);

    vi.stubGlobal("fetch", mockFetchOk({ ok: true, duplicate: true, expiresAt: Date.now() + 30 * 86_400_000, token: USDC, amountPaid: "1990000" }));

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

  it("on retry still failing: keeps state intact + fires retry-failed telemetry", async () => {
    withSufficientBalances();
    vi.stubGlobal("fetch", mockFetchOk({ ok: false, error: "amount_too_low" }));

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
    expect(result.current.sheetProps.verifyFailedTxHash).toBe(HASH);
    expect(result.current.sheetProps.errorMessage).not.toBeNull();
    expect(trackMock).toHaveBeenCalledWith(
      "pro_verify_retry_failed",
      expect.objectContaining({ tx_hash_prefix: HASH.slice(0, 10) }),
    );
  });
});
