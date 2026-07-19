import { afterEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";

vi.mock("@/lib/feature-flags", () => ({ CHESSCITO_LITE_MODE: true }));

import { useSeasonPassStatus } from "../use-season-pass-status";

const originalFetch = global.fetch;
const WALLET = "0xaaaabbbbccccddddeeeeffff0000111122223333";

afterEach(() => {
  vi.useRealTimers();
  global.fetch = originalFetch;
  vi.restoreAllMocks();
});

describe("useSeasonPassStatus", () => {
  it("exposes PRO as effective Training Pass coverage", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        active: true,
        source: "pro",
        seasonPassExpiresAt: null,
        proExpiresAt: 1_800_000_000_000,
      }),
    }) as unknown as typeof fetch;

    const { result } = renderHook(() => useSeasonPassStatus(WALLET));
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current).toMatchObject({
      active: true,
      source: "pro",
      seasonPassExpiresAt: null,
      proExpiresAt: 1_800_000_000_000,
      shieldsCredited: 0,
    });
  });

  it("preserves direct Season Pass metadata and shields", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        active: true,
        source: "season_pass",
        seasonPassExpiresAt: "2099-07-20T00:00:00.000Z",
        proExpiresAt: null,
        seasonId: "season-1",
        supporterStatus: "challenger",
        shieldsCredited: 3,
      }),
    }) as unknown as typeof fetch;

    const { result } = renderHook(() => useSeasonPassStatus(WALLET));
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current).toMatchObject({
      active: true,
      source: "season_pass",
      seasonId: "season-1",
      shieldsCredited: 3,
    });
  });

  it("refreshes at effective expiry so new premium starts are blocked", async () => {
    vi.useFakeTimers();
    const now = Date.parse("2026-07-19T12:00:00.000Z");
    vi.setSystemTime(now);
    const expiresAt = new Date(now + 1_000).toISOString();
    global.fetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          active: true,
          source: "season_pass",
          seasonPassExpiresAt: expiresAt,
          proExpiresAt: null,
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          active: false,
          source: null,
          seasonPassExpiresAt: expiresAt,
          proExpiresAt: null,
        }),
      }) as unknown as typeof fetch;

    const { result } = renderHook(() => useSeasonPassStatus(WALLET));
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(result.current).toMatchObject({ active: true, loading: false });

    await act(async () => {
      vi.advanceTimersByTime(1_050);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(result.current).toMatchObject({ active: false, loading: false });
  });

  it("never exposes one wallet's entitlement while resolving another wallet", async () => {
    let resolveSecond!: (value: Response) => void;
    global.fetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          active: true,
          source: "pro",
          seasonPassExpiresAt: null,
          proExpiresAt: 1_800_000_000_000,
        }),
      })
      .mockImplementationOnce(
        () => new Promise<Response>((resolve) => { resolveSecond = resolve; }),
      ) as unknown as typeof fetch;

    const { result, rerender } = renderHook(
      ({ wallet }) => useSeasonPassStatus(wallet),
      { initialProps: { wallet: WALLET } },
    );
    await waitFor(() => expect(result.current.active).toBe(true));

    rerender({ wallet: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" });
    expect(result.current).toMatchObject({ active: false, loading: true });

    resolveSecond({
      ok: true,
      json: async () => ({ active: false, source: null }),
    } as Response);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.active).toBe(false);
  });

  it("rejects an active response whose effective source is invalid", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        active: true,
        source: "unknown",
        seasonPassExpiresAt: "2099-01-01T00:00:00.000Z",
        proExpiresAt: 4_070_908_800_000,
      }),
    }) as unknown as typeof fetch;

    const { result } = renderHook(() => useSeasonPassStatus(WALLET));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current).toMatchObject({ active: false, source: null });
  });
});
