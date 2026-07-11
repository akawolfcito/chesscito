import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";

const WALLET = "0xcc4179a22b473ea2eb2b9b9b210458d0f60fc2dd" as const;
const TREASURY = "0x1681aaa1be1e0d4a4a1f4b8e0f6b3f4d5c6a7b8c" as const;
const TX_HASH = "0xabc0000000000000000000000000000000000000000000000000000000000001" as const;

const writeContractAsync = vi.fn(async () => TX_HASH);
const waitForTransactionReceipt = vi.fn(async () => ({ status: "success" }));

vi.mock("wagmi", () => ({
  useAccount: () => ({ address: WALLET }),
  useChainId: () => 42220,
  usePublicClient: () => ({ waitForTransactionReceipt }),
  useWriteContract: () => ({ writeContractAsync }),
}));

vi.mock("@/lib/payments/rail-config", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/payments/rail-config")>();
  return { ...actual, getTreasuryAddressClient: () => TREASURY };
});

import { readCreditedCache, writeCreditedCache } from "@/lib/shop/shield-storage";
import { useSeasonPassRail } from "@/lib/season-pass/use-season-pass-rail";

/** Routes fetch by URL: the pass verification answers a shield DELTA
 *  (`shieldsCredited: 3`), while /api/shields/me answers the ABSOLUTE
 *  monotonic counter. Only the latter is safe to cache. */
function mockFetch(credited: number) {
  return vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    const url = String(input);
    if (url.startsWith("/api/verify-payment")) {
      return new Response(
        JSON.stringify({
          ok: true,
          seasonId: "21day-mind-challenge-2026-q3",
          expiresAt: "2026-08-01T00:00:00.000Z",
          shieldsCredited: 3,
          supporterStatus: "challenger",
        }),
        { status: 200 },
      );
    }
    if (url.startsWith("/api/shields/me")) {
      return new Response(JSON.stringify({ ok: true, credited }), {
        status: 200,
      });
    }
    throw new Error(`unexpected fetch: ${url}`);
  });
}

describe("useSeasonPassRail — post-purchase shield reconciliation", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
    writeContractAsync.mockClear();
    waitForTransactionReceipt.mockClear();
  });

  it("refreshes the credited-cache from the server once the payment verifies", async () => {
    // Buyer already held a stale cache (e.g. spent down before buying).
    writeCreditedCache(1);
    mockFetch(6);

    const { result } = renderHook(() =>
      useSeasonPassRail({ sku: "lite_season_pass_21", tokenSymbol: "USDC" }),
    );

    await act(async () => {
      await result.current.pay();
    });

    await waitFor(() => expect(result.current.phase).toBe("success"));
    // Without the reconciliation the chip keeps rendering the stale 1
    // until some other screen remounts useShieldSync.
    expect(readCreditedCache()).toBe(6);
  });

  it("still reports success when the shield read fails", async () => {
    writeCreditedCache(1);
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      if (url.startsWith("/api/verify-payment")) {
        return new Response(
          JSON.stringify({ ok: true, shieldsCredited: 3 }),
          { status: 200 },
        );
      }
      return new Response("nope", { status: 500 });
    });

    const { result } = renderHook(() =>
      useSeasonPassRail({ sku: "lite_season_pass_21", tokenSymbol: "USDC" }),
    );

    await act(async () => {
      await result.current.pay();
    });

    await waitFor(() => expect(result.current.phase).toBe("success"));
    expect(result.current.result?.shieldsCredited).toBe(3);
    expect(readCreditedCache()).toBe(1);
  });

  it("fires onVerified after the cache is reconciled", async () => {
    mockFetch(6);
    const seenAtCallback: number[] = [];

    const { result } = renderHook(() =>
      useSeasonPassRail({
        sku: "lite_season_pass_21",
        tokenSymbol: "USDC",
        onVerified: () => seenAtCallback.push(readCreditedCache()),
      }),
    );

    await act(async () => {
      await result.current.pay();
    });

    await waitFor(() => expect(result.current.phase).toBe("success"));
    // The hub's onSuccess closes the sheet — by then the count must be real.
    expect(seenAtCallback).toEqual([6]);
  });
});
