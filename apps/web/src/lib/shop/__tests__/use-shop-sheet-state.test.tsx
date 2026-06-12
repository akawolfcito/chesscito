import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook as renderHookRaw, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";
import enMessages from "@/lib/content/messages/en";

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

const renderHook = <T,>(callback: () => T) =>
  renderHookRaw(callback, { wrapper: IntlWrapper });

const TEST_WALLET = "0x000000000000000000000000000000000000abcd";
const SHOP_ADDRESS = "0x0000000000000000000000000000000000005099";
const TEST_CHAIN_ID = 42220;

// Mints the canonical SHOP_ITEMS shape consumed by useReadContracts.
// Order MUST match SHOP_ITEMS exactly:
//   PRO 6 ($1.99) → Founder 1 ($0.10) → Shield 2 ($0.025) →
//   CoachPack5 3 ($0.05) → CoachPack20 4 ($0.10) → CELO sibling 5.
function makeOnChainItems({
  celoConfigured = true,
  proConfigured = true,
} = {}) {
  return [
    {
      status: proConfigured ? "success" : "failure",
      result: proConfigured ? [1_990_000n, true] : null,
    }, // PRO $1.99
    { status: "success", result: [100_000n, true] }, // Founder $0.10
    { status: "success", result: [25_000n, true] }, // Shield $0.025
    { status: "success", result: [50_000n, true] }, // CoachPack5 $0.05
    { status: "success", result: [100_000n, true] }, // CoachPack20 $0.10
    {
      status: celoConfigured ? "success" : "failure",
      result: celoConfigured ? [1_000_000_000_000_000_000n, true] : null,
    },
  ];
}

// One stable token + plenty of CELO. Index 0 = USDC, last = CELO.
function makeBalances({ stableBalance = 1_000_000n, celoBalance = 10n ** 18n } = {}) {
  return [
    { status: "success", result: stableBalance }, // USDC
    { status: "success", result: stableBalance }, // USDT
    { status: "success", result: stableBalance }, // cUSD
    { status: "success", result: celoBalance }, // CELO
  ];
}

const useAccountMock = vi.hoisted(() =>
  vi.fn(() => ({ address: TEST_WALLET, isConnected: true })),
);
const useChainIdMock = vi.hoisted(() => vi.fn(() => TEST_CHAIN_ID));
// Read-contracts mock alternates between two return shapes — catalog
// (3 items) on even calls, balances (4 tokens) on odd calls. Each
// React render of the hook triggers this pair, so the alternator
// stays in lockstep across re-renders. `setReadContractsState` resets
// the counter + payloads.
let readContractsCallIndex = 0;
let catalogPayload: unknown = undefined;
let balancesPayload: unknown = undefined;
function setReadContractsState({
  catalog,
  balances,
}: {
  catalog?: unknown;
  balances?: unknown;
}) {
  readContractsCallIndex = 0;
  catalogPayload = catalog;
  balancesPayload = balances;
}
const useReadContractsMock = vi.hoisted(() =>
  vi.fn(() => {
    // Catalog first (even calls), balances second (odd) within each render.
    return readContractsCallIndex++ % 2 === 0
      ? { data: catalogPayload }
      : { data: balancesPayload };
  }),
);
const useReadContractMock = vi.hoisted(() => vi.fn(() => ({ data: 0n })));
const useWaitForReceiptMock = vi.hoisted(() =>
  vi.fn(() => ({ isLoading: false, isSuccess: false })),
);
const writeContractAsyncMock = vi.hoisted(() => vi.fn());
const useWriteContractMock = vi.hoisted(() =>
  vi.fn(() => ({
    writeContractAsync: writeContractAsyncMock,
    isPending: false,
  })),
);
const usePublicClientMock = vi.hoisted(() =>
  vi.fn(() => ({
    readContract: vi.fn().mockResolvedValue(0n),
  })),
);
const useSwitchChainMock = vi.hoisted(() => vi.fn(() => ({ switchChain: vi.fn() })));
const useConnectWalletMock = vi.hoisted(() =>
  vi.fn(() => ({ connectWallet: vi.fn(), isConnecting: false })),
);
const useMiniPayMock = vi.hoisted(() =>
  vi.fn(() => ({ hasProvider: false, isMiniPay: false, isReady: true })),
);
const trackMock = vi.hoisted(() => vi.fn());
const hapticSuccessMock = vi.hoisted(() => vi.fn());
const dispatchShieldChangeMock = vi.hoisted(() => vi.fn());
const waitForReceiptMock = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));

vi.mock("wagmi", () => ({
  useAccount: () => useAccountMock(),
  useChainId: () => useChainIdMock(),
  useReadContracts: () => useReadContractsMock(),
  useReadContract: () => useReadContractMock(),
  useWaitForTransactionReceipt: () => useWaitForReceiptMock(),
  useWriteContract: () => useWriteContractMock(),
  usePublicClient: () => usePublicClientMock(),
  useSwitchChain: () => useSwitchChainMock(),
}));

vi.mock("@/lib/wallet/use-connect-wallet", () => ({
  useConnectWallet: () => useConnectWalletMock(),
}));

// Welcome Pack hook is wired into useShopSheetState; mock it here so
// this test stays focused on shop purchase orchestration. End-to-end
// coverage for the claim flow lives in use-welcome-pack-claim tests.
vi.mock("@/lib/shop/use-welcome-pack-claim", () => ({
  useWelcomePackClaim: () => ({
    state: "connect",
    claimedAt: null,
    onClaim: vi.fn(),
    onConnect: vi.fn(),
  }),
}));

vi.mock("@/hooks/use-minipay", () => ({
  useMiniPay: () => useMiniPayMock(),
}));

vi.mock("@/lib/contracts/chains", () => ({
  getConfiguredChainId: () => TEST_CHAIN_ID,
  getMiniPayFeeCurrency: () => undefined,
  getShopAddress: () => SHOP_ADDRESS,
}));

vi.mock("@/lib/contracts/shop", () => ({ shopAbi: [] as const }));

vi.mock("@/lib/telemetry", () => ({
  track: (...args: unknown[]) => trackMock(...args),
}));

vi.mock("@/lib/haptics", () => ({
  hapticSuccess: () => hapticSuccessMock(),
}));

vi.mock("@/lib/shop/shield-events", () => ({
  dispatchShieldChange: () => dispatchShieldChangeMock(),
  subscribeToShieldChanges: () => () => {},
}));

vi.mock("@/lib/contracts/transaction-helpers", () => ({
  waitForReceiptWithTimeout: (...args: unknown[]) => waitForReceiptMock(...args),
}));

vi.mock("@/lib/errors", () => ({
  classifyTxError: () => "error",
  classifyTxErrorKind: () => "unknown",
  isTransactionTimeout: (err: unknown) =>
    err instanceof Error && err.message.includes("timeout"),
  isUserCancellation: (err: unknown) =>
    err instanceof Error && err.message.includes("User rejected"),
}));

import { useShopSheetState } from "../use-shop-sheet-state";

beforeEach(() => {
  vi.clearAllMocks();
  setReadContractsState({ catalog: undefined, balances: undefined });
  useAccountMock.mockReturnValue({ address: TEST_WALLET, isConnected: true });
  useChainIdMock.mockReturnValue(TEST_CHAIN_ID);
  useReadContractMock.mockReturnValue({ data: 0n });
  useWaitForReceiptMock.mockReturnValue({ isLoading: false, isSuccess: false });
  useWriteContractMock.mockReturnValue({
    writeContractAsync: writeContractAsyncMock,
    isPending: false,
  });
  usePublicClientMock.mockReturnValue({
    readContract: vi.fn().mockResolvedValue(0n),
  });
  useMiniPayMock.mockReturnValue({
    hasProvider: false,
    isMiniPay: false,
    isReady: true,
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("useShopSheetState — open/close", () => {
  it("starts closed and openSheet flips it open", () => {
    const { result } = renderHook(() => useShopSheetState());
    expect(result.current.open).toBe(false);
    expect(result.current.sheetProps.open).toBe(false);
    expect(result.current.sheetProps.showTrigger).toBe(false);

    act(() => result.current.openSheet());
    expect(result.current.open).toBe(true);
  });

  it("confirmProps.onOpenChange(false) is a no-op while purchasePhase !== idle", async () => {
    // Set up a purchasable state.
    const items = makeOnChainItems();
    setReadContractsState({ catalog: items, balances: makeBalances() });

    // Hold approve hash so purchasePhase locks at "approving".
    let resolveApprove: (hash: string) => void = () => {};
    writeContractAsyncMock.mockImplementationOnce(
      () =>
        new Promise<string>((resolve) => {
          resolveApprove = resolve;
        }),
    );
    // First, `publicClient.readContract` returns 0 allowance → triggers approve.
    usePublicClientMock.mockReturnValue({
      readContract: vi.fn().mockResolvedValue(0n),
    });

    const { result } = renderHook(() => useShopSheetState());

    // Pick the Shield item so we hit the approve path.
    act(() => {
      result.current.sheetProps.onSelectItem(2n);
    });

    act(() => {
      result.current.confirmProps.onConfirm();
    });

    await waitFor(() => {
      expect(result.current.confirmProps.purchasePhase).toBe("approving");
    });

    // Try to dismiss mid-tx — must be ignored.
    act(() => {
      result.current.confirmProps.onOpenChange(false);
    });
    expect(result.current.confirmProps.open).toBe(true);

    // Drain.
    resolveApprove("0xapprove");
    await waitFor(() => {
      expect(result.current.confirmProps.purchasePhase).toBe("idle");
    });
  });
});

describe("useShopSheetState — handleSelectItem", () => {
  it("opens confirm sheet with the selected item + payment token", () => {
    setReadContractsState({ catalog: makeOnChainItems(), balances: makeBalances() });

    const { result } = renderHook(() => useShopSheetState());

    act(() => {
      result.current.sheetProps.onSelectItem(1n); // Founder Badge
    });

    expect(result.current.confirmProps.open).toBe(true);
    expect(result.current.confirmProps.selectedItem?.itemId).toBe(1n);
    expect(result.current.confirmProps.paymentTokenSymbol).toBeTruthy();
  });
});

describe("useShopSheetState — handleConfirmPurchase guards", () => {
  it("wrong-chain blocks the purchase", async () => {
    useChainIdMock.mockReturnValue(99); // not the configured chain
    setReadContractsState({ catalog: makeOnChainItems(), balances: makeBalances() });

    const { result } = renderHook(() => useShopSheetState());
    act(() => result.current.sheetProps.onSelectItem(2n));
    act(() => result.current.confirmProps.onConfirm());

    await waitFor(() => {
      // tx never fired
      expect(writeContractAsyncMock).not.toHaveBeenCalled();
    });
    expect(result.current.confirmProps.purchasePhase).toBe("idle");
    // Sheet stays open so the user can react to the surfaced error.
    expect(result.current.confirmProps.open).toBe(true);
  });

  it("missing payment token blocks the purchase", async () => {
    setReadContractsState({ catalog: makeOnChainItems(), balances: undefined });

    const { result } = renderHook(() => useShopSheetState());
    act(() => result.current.sheetProps.onSelectItem(2n));
    act(() => result.current.confirmProps.onConfirm());

    await waitFor(() => {
      expect(writeContractAsyncMock).not.toHaveBeenCalled();
    });
    expect(result.current.confirmProps.paymentTokenSymbol).toBeNull();
  });
});

describe("useShopSheetState — successful Shield purchase", () => {
  it("skips approve when allowance is sufficient + posts to /api/credit-shield", async () => {
    setReadContractsState({ catalog: makeOnChainItems(), balances: makeBalances() });

    // Allowance large enough → approve path skipped.
    usePublicClientMock.mockReturnValue({
      readContract: vi.fn().mockResolvedValue(10n ** 30n),
    });
    writeContractAsyncMock.mockResolvedValueOnce("0xbuyhash");

    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        new Response(
          JSON.stringify({
            ok: true,
            credited: 3,
            delta: 3,
            txHash: "0xbuyhash",
          }),
          { status: 200 },
        ),
      );

    const { result } = renderHook(() => useShopSheetState());
    act(() => result.current.sheetProps.onSelectItem(2n));
    act(() => result.current.confirmProps.onConfirm());

    await waitFor(() => {
      expect(writeContractAsyncMock).toHaveBeenCalledTimes(1);
    });
    const firstCall = writeContractAsyncMock.mock.calls[0]?.[0] as
      | { functionName?: string }
      | undefined;
    expect(firstCall?.functionName).toBe("buyItem");

    await waitFor(() => {
      expect(result.current.sheetProps.successBanner).not.toBeNull();
    });
    expect(hapticSuccessMock).toHaveBeenCalled();
    expect(trackMock).toHaveBeenCalledWith(
      "shop_buy_tx",
      expect.objectContaining({ stage: "success", source: "shop_retry_shield" }),
    );

    // AC15: server-side credit fired with correct body shape.
    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalled();
    });
    const fetchCall = fetchSpy.mock.calls.find(([input]) => {
      const url = typeof input === "string" ? input : (input as Request).url;
      return url.includes("/api/credit-shield");
    });
    expect(fetchCall).toBeDefined();
    const init = fetchCall?.[1] as RequestInit | undefined;
    expect(init?.method).toBe("POST");
    expect(JSON.parse(init?.body as string)).toEqual({
      txHash: "0xbuyhash",
      walletAddress: TEST_WALLET,
    });

    fetchSpy.mockRestore();
  });

  it("dispatches shield-changed after a successful 2xx server credit", async () => {
    setReadContractsState({ catalog: makeOnChainItems(), balances: makeBalances() });
    usePublicClientMock.mockReturnValue({
      readContract: vi.fn().mockResolvedValue(10n ** 30n),
    });
    writeContractAsyncMock.mockResolvedValueOnce("0xbuyhash");

    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        new Response(
          JSON.stringify({
            ok: true,
            credited: 3,
            delta: 3,
            txHash: "0xbuyhash",
          }),
          { status: 200 },
        ),
      );

    const { result } = renderHook(() => useShopSheetState());
    act(() => result.current.sheetProps.onSelectItem(2n));
    act(() => result.current.confirmProps.onConfirm());

    await waitFor(() => {
      expect(result.current.sheetProps.successBanner).not.toBeNull();
    });

    await waitFor(() => {
      expect(dispatchShieldChangeMock).toHaveBeenCalled();
    });

    fetchSpy.mockRestore();
  });

  it("4xx response from /api/credit-shield does NOT dispatch shield-changed (entry stays queued)", async () => {
    setReadContractsState({ catalog: makeOnChainItems(), balances: makeBalances() });
    usePublicClientMock.mockReturnValue({
      readContract: vi.fn().mockResolvedValue(10n ** 30n),
    });
    writeContractAsyncMock.mockResolvedValueOnce("0xbuyhash");

    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        new Response(
          JSON.stringify({ ok: false, error: "unprocessable" }),
          { status: 400 },
        ),
      );

    const { result } = renderHook(() => useShopSheetState());
    act(() => result.current.sheetProps.onSelectItem(2n));
    act(() => result.current.confirmProps.onConfirm());

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalled();
    });
    // Banner still fires (banner truthfulness = "tx submitted").
    await waitFor(() => {
      expect(result.current.sheetProps.successBanner).not.toBeNull();
    });
    // Local credit-cache write was skipped → no dispatch from this path.
    expect(dispatchShieldChangeMock).not.toHaveBeenCalled();

    fetchSpy.mockRestore();
  });
});

describe("useShopSheetState — error paths", () => {
  it("user cancellation closes the confirm sheet without surfacing an error", async () => {
    setReadContractsState({ catalog: makeOnChainItems(), balances: makeBalances() });
    usePublicClientMock.mockReturnValue({
      readContract: vi.fn().mockResolvedValue(10n ** 30n),
    });
    writeContractAsyncMock.mockRejectedValueOnce(
      new Error("User rejected the request"),
    );

    const { result } = renderHook(() => useShopSheetState());
    act(() => result.current.sheetProps.onSelectItem(2n));
    act(() => result.current.confirmProps.onConfirm());

    await waitFor(() => {
      expect(result.current.confirmProps.open).toBe(false);
    });
    expect(trackMock).toHaveBeenCalledWith(
      "shop_buy_tx",
      expect.objectContaining({ stage: "cancelled" }),
    );
  });

  it("timeout error closes confirm + emits error_kind=timeout", async () => {
    setReadContractsState({ catalog: makeOnChainItems(), balances: makeBalances() });
    usePublicClientMock.mockReturnValue({
      readContract: vi.fn().mockResolvedValue(10n ** 30n),
    });
    writeContractAsyncMock.mockRejectedValueOnce(
      new Error("Transaction timeout"),
    );

    const { result } = renderHook(() => useShopSheetState());
    act(() => result.current.sheetProps.onSelectItem(2n));
    act(() => result.current.confirmProps.onConfirm());

    await waitFor(() => {
      expect(result.current.confirmProps.open).toBe(false);
    });
    expect(trackMock).toHaveBeenCalledWith(
      "shop_buy_tx",
      expect.objectContaining({ stage: "error", error_kind: "timeout" }),
    );
  });
});

describe("useShopSheetState — CELO sibling visibility", () => {
  it("hides the CELO sibling button inside MiniPay", () => {
    useMiniPayMock.mockReturnValue({
      hasProvider: true,
      isMiniPay: true,
      isReady: true,
    });
    setReadContractsState({ catalog: makeOnChainItems(), balances: makeBalances() });

    const { result } = renderHook(() => useShopSheetState());

    const founder = result.current.sheetProps.items.find((i) => i.itemId === 1n);
    expect(founder?.celoSibling).toBeFalsy();
  });

  it("surfaces CELO sibling on Founder Badge outside MiniPay", () => {
    useMiniPayMock.mockReturnValue({
      hasProvider: false,
      isMiniPay: false,
      isReady: true,
    });
    setReadContractsState({ catalog: makeOnChainItems(), balances: makeBalances() });

    const { result } = renderHook(() => useShopSheetState());

    const founder = result.current.sheetProps.items.find((i) => i.itemId === 1n);
    expect(founder?.celoSibling?.itemId).toBe(5n);
    // The standalone CELO entry is filtered out — the user only sees it
    // as the secondary CTA on the Founder card.
    const celoEntry = result.current.sheetProps.items.find((i) => i.itemId === 5n);
    expect(celoEntry).toBeUndefined();
  });
});

describe("useShopSheetState — PRO purchase", () => {
  it("renders PRO (itemId 6n) in the sheet items so the user can tap it from the shop", () => {
    setReadContractsState({ catalog: makeOnChainItems(), balances: makeBalances() });
    const { result } = renderHook(() => useShopSheetState());
    const pro = result.current.sheetProps.items.find((i) => i.itemId === 6n);
    expect(pro).toBeDefined();
    expect(pro?.enabled).toBe(true);
    expect(pro?.onChainPrice).toBe(1_990_000n);
  });

  it("POSTs /api/verify-pro with the txHash + wallet after a successful PRO buy", async () => {
    // PRO = $1.99 (1_990_000 USD6). Default balance helper provisions $1
    // per stable — need to top up so `selectPaymentToken` finds enough
    // funds to clear the price gate.
    setReadContractsState({
      catalog: makeOnChainItems(),
      balances: makeBalances({ stableBalance: 5_000_000n }),
    });
    usePublicClientMock.mockReturnValue({
      readContract: vi.fn().mockResolvedValue(10n ** 30n),
    });
    writeContractAsyncMock.mockResolvedValueOnce("0xprobuy");

    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        new Response(
          JSON.stringify({ active: true, expiresAt: Date.now() + 86_400_000 }),
          { status: 200 },
        ),
      );

    const { result } = renderHook(() => useShopSheetState());
    act(() => result.current.sheetProps.onSelectItem(6n));
    act(() => result.current.confirmProps.onConfirm());

    await waitFor(() => {
      expect(result.current.sheetProps.successBanner).not.toBeNull();
    });

    expect(trackMock).toHaveBeenCalledWith(
      "shop_buy_tx",
      expect.objectContaining({ stage: "success", source: "shop_pro" }),
    );

    const verifyCall = fetchSpy.mock.calls.find(([input]) => {
      const url = typeof input === "string" ? input : (input as Request).url;
      return url.includes("/api/verify-pro");
    });
    expect(verifyCall).toBeDefined();
    const init = verifyCall?.[1] as RequestInit | undefined;
    expect(init?.method).toBe("POST");
    expect(JSON.parse(init?.body as string)).toEqual({
      txHash: "0xprobuy",
      walletAddress: TEST_WALLET,
    });

    fetchSpy.mockRestore();
  });
});
