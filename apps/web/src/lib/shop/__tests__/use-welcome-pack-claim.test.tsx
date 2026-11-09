import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";

const WALLET = "0xcc4179a22b473ea2eb2b9b9b210458d0f60fc2dd" as const;

const signMessageAsync = vi.fn(async () => "0xsignature" as `0x${string}`);

vi.mock("wagmi", () => ({
  useAccount: () => ({ address: WALLET, isConnected: true }),
  useSignMessage: () => ({ signMessageAsync }),
}));

vi.mock("@/lib/wallet/use-connect-wallet", () => ({
  useConnectWallet: () => ({ connectWallet: vi.fn() }),
}));

import { readCreditedCache, writeCreditedCache } from "@/lib/shop/shield-storage";
import { useWelcomePackClaim } from "@/lib/shop/use-welcome-pack-claim";

/** `/api/welcome-pack/claim` answers the ABSOLUTE credited counter (the
 *  return of the Redis INCRBY), so the client can cache it as-is. */
function mockClaim(payload: Record<string, unknown>) {
  return vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    const url = String(input);
    if (url.startsWith("/api/welcome-pack/status")) {
      return new Response(JSON.stringify({ ok: true, claimed: false }), {
        status: 200,
      });
    }
    if (url.startsWith("/api/welcome-pack/claim")) {
      return new Response(JSON.stringify(payload), { status: 200 });
    }
    throw new Error(`unexpected fetch: ${url}`);
  });
}

describe("useWelcomePackClaim — credited-cache reconciliation", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
    signMessageAsync.mockClear();
  });

  it("caches the credited counter the claim returns", async () => {
    mockClaim({
      ok: true,
      claimed: true,
      shields_granted: 3,
      credited: 3,
      claimed_at: "2026-07-11T00:00:00.000Z",
    });

    const { result } = renderHook(() => useWelcomePackClaim());
    await waitFor(() => expect(result.current.state).toBe("idle"));

    await act(async () => {
      result.current.onClaim();
    });

    await waitFor(() => expect(result.current.state).toBe("claimed"));
    // Dispatching the change event without writing the counter made every
    // subscriber re-read a stale localStorage — the chip stayed at 0.
    expect(readCreditedCache()).toBe(3);
  });

  it("does not touch the cache on an already-claimed pack", async () => {
    writeCreditedCache(3);
    mockClaim({
      ok: true,
      already_claimed: true,
      claimed_at: "2026-07-01T00:00:00.000Z",
    });

    const { result } = renderHook(() => useWelcomePackClaim());
    await waitFor(() => expect(result.current.state).toBe("idle"));

    await act(async () => {
      result.current.onClaim();
    });

    await waitFor(() => expect(result.current.state).toBe("claimed"));
    expect(readCreditedCache()).toBe(3);
  });
});
