import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";

const useAccountMock = vi.fn();
const attemptShieldSpendWithPeonesMock = vi.fn();

vi.mock("wagmi", () => ({
  useAccount: () => useAccountMock(),
  useSignMessage: () => ({ signMessageAsync: vi.fn() }),
  useConnect: () => ({ connect: vi.fn(), connectors: [], isPending: false }),
}));

vi.mock("@/lib/wallet/use-connect-wallet", () => ({
  useConnectWallet: () => ({ connectWallet: vi.fn(), isConnecting: false }),
}));

vi.mock("@/lib/peones/shield-spend-fallback", () => ({
  attemptShieldSpendWithPeones: (
    ...args: Parameters<typeof attemptShieldSpendWithPeonesMock>
  ) => attemptShieldSpendWithPeonesMock(...args),
}));

import { useFailRescue, type UseFailRescueOptions } from "../use-fail-rescue";
import {
  SHIELDS_CREDITED_CACHE_KEY,
  SHIELDS_CONSUMED_KEY,
} from "@/lib/shop/shield-storage";

const WALLET = "0x1234567890abcdef1234567890abcdef12345678";

function setShieldsCount(n: number): void {
  window.localStorage.setItem(SHIELDS_CREDITED_CACHE_KEY, String(n));
  window.localStorage.setItem(SHIELDS_CONSUMED_KEY, "0");
}

function baseOptions(
  overrides: Partial<UseFailRescueOptions> = {},
): UseFailRescueOptions {
  return {
    onRescued: vi.fn(),
    onSkipped: vi.fn(),
    onServerError: vi.fn(),
    onClaimWelcomePack: vi.fn(),
    attemptSeq: 1,
    welcomePackClaimed: false,
    ...overrides,
  };
}

describe("useFailRescue — onClaimFree (variant C)", () => {
  beforeEach(() => {
    useAccountMock.mockReturnValue({ address: WALLET });
    setShieldsCount(0);
  });

  // The Welcome Pack is a FREE gift. It used to deep-link into the Shop
  // ("We'll take you to the Shop"), which sent the player out of the rescue to
  // a catalog of paid SKUs to collect something that costs nothing — and the
  // focus argument was dropped on the floor by the caller anyway
  // (exercises-screen implemented `() => void` against a
  // `(focus: "welcome-pack") => void` contract; TS accepts the narrower
  // signature, so the deep link never had a target). Claim in place instead.
  it("claims the Welcome Pack in place — never routes to the Shop", () => {
    const onClaimWelcomePack = vi.fn();
    const { result } = renderHook(() =>
      useFailRescue(baseOptions({ onClaimWelcomePack })),
    );

    act(() => { result.current.onClaimFree(); });

    expect(onClaimWelcomePack).toHaveBeenCalledTimes(1);
  });
});

type FetchArgs = [string, RequestInit | undefined];

describe("useFailRescue — onUseShield Peones fallback", () => {
  beforeEach(() => {
    useAccountMock.mockReset();
    useAccountMock.mockReturnValue({ address: WALLET, isConnected: true });
    attemptShieldSpendWithPeonesMock.mockReset();
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("falls through to the Peones fallback when shieldsCount is 0 and the counter path is insufficient", async () => {
    setShieldsCount(0);
    const options = baseOptions();

    const fetchMock = vi.fn(async (...args: FetchArgs) => {
      const [url, init] = args;
      if (url === "/api/shields/spend") {
        const body = init?.body ? JSON.parse(init.body as string) : {};
        if (body.peonesIdempotencyKey) {
          return { ok: true, json: async () => ({ ok: true }) };
        }
        return {
          ok: false,
          status: 409,
          json: async () => ({ error: "insufficient" }),
        };
      }
      return { ok: false, status: 404, json: async () => ({}) };
    });
    vi.stubGlobal("fetch", fetchMock);

    attemptShieldSpendWithPeonesMock.mockResolvedValue({
      kind: "paid",
      peonesIdempotencyKey: `spend:shield:${WALLET.toLowerCase()}:1`,
      debited: 2,
      duplicate: false,
      proBypassApplied: false,
      newBalance: 8,
      attestationHash: "0xabc",
    });

    const { result } = renderHook(() => useFailRescue(options));

    await act(async () => {
      result.current.onUseShield();
    });

    await waitFor(() => expect(options.onRescued).toHaveBeenCalledTimes(1));
    expect(options.onSkipped).not.toHaveBeenCalled();
    expect(options.onServerError).not.toHaveBeenCalled();
    expect(attemptShieldSpendWithPeonesMock).toHaveBeenCalledWith({
      wallet: WALLET,
      attemptSeq: 1,
    });

    const spendCalls = fetchMock.mock.calls.filter(
      ([url]) => url === "/api/shields/spend",
    );
    expect(spendCalls).toHaveLength(2);
    const secondCallBody = JSON.parse(
      (spendCalls[1][1] as RequestInit).body as string,
    );
    expect(secondCallBody).toMatchObject({
      walletAddress: WALLET,
      peonesIdempotencyKey: `spend:shield:${WALLET.toLowerCase()}:1`,
      attemptSeq: 1,
    });
  });

  it("does not attempt the Peones fallback when shieldsCount > 0 (counter path succeeds normally)", async () => {
    setShieldsCount(3);
    const options = baseOptions();

    const fetchMock = vi.fn(async (...args: FetchArgs) => {
      const [url] = args;
      if (url === "/api/shields/spend") {
        return {
          ok: true,
          json: async () => ({ ok: true, spent: 1, balance: 2 }),
        };
      }
      return { ok: false, status: 404, json: async () => ({}) };
    });
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useFailRescue(options));

    await waitFor(() => expect(result.current.shieldsCount).toBe(3));

    await act(async () => {
      result.current.onUseShield();
    });

    await waitFor(() => expect(options.onRescued).toHaveBeenCalledTimes(1));
    expect(attemptShieldSpendWithPeonesMock).not.toHaveBeenCalled();

    const spendCalls = fetchMock.mock.calls.filter(
      ([url]) => url === "/api/shields/spend",
    );
    expect(spendCalls).toHaveLength(1);
  });

  it("falls through to onSkipped when the Peones fallback itself returns insufficient", async () => {
    setShieldsCount(0);
    const options = baseOptions();

    const fetchMock = vi.fn(async (...args: FetchArgs) => {
      const [url] = args;
      if (url === "/api/shields/spend") {
        return {
          ok: false,
          status: 409,
          json: async () => ({ error: "insufficient" }),
        };
      }
      return { ok: false, status: 404, json: async () => ({}) };
    });
    vi.stubGlobal("fetch", fetchMock);

    attemptShieldSpendWithPeonesMock.mockResolvedValue({ kind: "insufficient" });

    const { result } = renderHook(() => useFailRescue(options));

    await act(async () => {
      result.current.onUseShield();
    });

    await waitFor(() => expect(options.onSkipped).toHaveBeenCalledTimes(1));
    expect(options.onServerError).not.toHaveBeenCalled();
    expect(options.onRescued).not.toHaveBeenCalled();
    expect(attemptShieldSpendWithPeonesMock).toHaveBeenCalledWith({
      wallet: WALLET,
      attemptSeq: 1,
    });

    const spendCalls = fetchMock.mock.calls.filter(
      ([url]) => url === "/api/shields/spend",
    );
    expect(spendCalls).toHaveLength(1);
  });
});

describe("useFailRescue — welcomePackClaimed as a prop (single source of truth)", () => {
  it("selects variant D immediately from the passed-in flag, without an internal welcome-pack fetch or a stale desync", async () => {
    setShieldsCount(0);
    const options = baseOptions({ welcomePackClaimed: true });

    const fetchMock = vi.fn(async (...args: FetchArgs) => {
      const [url] = args;
      // If useFailRescue still owned its own useWelcomePackClaim()
      // instance, it would hit this endpoint and this test would see
      // the request. It must not — the flag comes from the caller now.
      if (url.includes("/api/welcome-pack/status")) {
        throw new Error(
          "useFailRescue must not fetch welcome-pack status itself",
        );
      }
      return { ok: false, status: 404, json: async () => ({}) };
    });
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useFailRescue(options));

    await waitFor(() => expect(result.current.variant).toBe("D"));
  });
});
