/**
 * Tests for usePeonesBalance — Sprint 3 commit G of Training
 * Economy Alpha (2026-06-07). Pure read-only hook. wagmi mocked
 * so the test can toggle guest vs connected per-test; fetch
 * injected so no network round-trip happens.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const useAccountMock = vi.hoisted(() => vi.fn());
vi.mock("wagmi", () => ({
  useAccount: useAccountMock,
}));

import { act, renderHook, waitFor } from "@testing-library/react";

import { usePeonesBalance } from "@/lib/peones/use-peones-balance";

const W = "0xabcdef0123456789abcdef0123456789abcdef01";
const W_UPPER = "0xABCDEF0123456789ABCDEF0123456789ABCDEF01";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

beforeEach(() => {
  useAccountMock.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("usePeonesBalance — guest path", () => {
  it("returns guest state without fetching when no wallet is connected", async () => {
    useAccountMock.mockReturnValue({ isConnected: false, address: undefined });
    const fetchImpl = vi.fn();

    const { result } = renderHook(() => usePeonesBalance({ fetchImpl }));

    expect(result.current.state).toEqual({ kind: "guest" });
    await Promise.resolve();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("returns guest state when address is undefined even if isConnected=true", async () => {
    useAccountMock.mockReturnValue({ isConnected: true, address: undefined });
    const fetchImpl = vi.fn();

    const { result } = renderHook(() => usePeonesBalance({ fetchImpl }));

    await Promise.resolve();
    expect(result.current.state).toEqual({ kind: "guest" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

describe("usePeonesBalance — connected success", () => {
  it("fetches the balance with a normalised lowercase wallet", async () => {
    useAccountMock.mockReturnValue({ isConnected: true, address: W_UPPER });
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse({
        wallet: W,
        balance: 12,
        dailyEarnedCapped: 6,
        dailyCap: 10,
        lastEventAt: "2026-06-07T10:00:00Z",
      }),
    );

    const { result } = renderHook(() => usePeonesBalance({ fetchImpl }));

    await waitFor(() => expect(result.current.state.kind).toBe("success"));
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl).toHaveBeenCalledWith(
      `/api/peones/balance?wallet=${encodeURIComponent(W)}`,
    );

    expect(result.current.state).toEqual({
      kind: "success",
      balance: 12,
      dailyEarnedCapped: 6,
      dailyCap: 10,
      lastEventAt: "2026-06-07T10:00:00Z",
    });
  });

  it("falls back to dailyCap=10 when the response omits it", async () => {
    useAccountMock.mockReturnValue({ isConnected: true, address: W });
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse({ balance: 0, dailyEarnedCapped: 0 }),
    );

    const { result } = renderHook(() => usePeonesBalance({ fetchImpl }));

    await waitFor(() => expect(result.current.state.kind).toBe("success"));
    expect(result.current.state).toMatchObject({
      kind: "success",
      balance: 0,
      dailyCap: 10,
      lastEventAt: null,
    });
  });
});

describe("usePeonesBalance — error paths (non-aggressive)", () => {
  it("returns error on a network fault — chip will render the discrete fallback", async () => {
    useAccountMock.mockReturnValue({ isConnected: true, address: W });
    const fetchImpl = vi.fn().mockRejectedValue(new Error("network down"));

    const { result } = renderHook(() => usePeonesBalance({ fetchImpl }));

    await waitFor(() => expect(result.current.state.kind).toBe("error"));
  });

  it("returns error on a 500 response — pre-migration safe", async () => {
    useAccountMock.mockReturnValue({ isConnected: true, address: W });
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse({ error: "ledger_unavailable" }, 500),
    );

    const { result } = renderHook(() => usePeonesBalance({ fetchImpl }));

    await waitFor(() => expect(result.current.state.kind).toBe("error"));
  });

  it("returns error on bad JSON without throwing into the render", async () => {
    useAccountMock.mockReturnValue({ isConnected: true, address: W });
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response("not-json", { status: 200 }),
    );

    const { result } = renderHook(() => usePeonesBalance({ fetchImpl }));

    await waitFor(() => expect(result.current.state.kind).toBe("error"));
  });
});

describe("usePeonesBalance — refetch behaviour", () => {
  it("refetch triggers a second network call and updates state", async () => {
    useAccountMock.mockReturnValue({ isConnected: true, address: W });
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ balance: 1, dailyEarnedCapped: 1, dailyCap: 10 }))
      .mockResolvedValueOnce(jsonResponse({ balance: 4, dailyEarnedCapped: 4, dailyCap: 10 }));

    const { result } = renderHook(() => usePeonesBalance({ fetchImpl }));

    await waitFor(() => expect(result.current.state).toMatchObject({ kind: "success", balance: 1 }));

    await act(async () => {
      await result.current.refetch();
    });

    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(result.current.state).toMatchObject({ kind: "success", balance: 4 });
  });

  it("does NOT poll on its own (no interval) — fetch is called exactly once after mount", async () => {
    useAccountMock.mockReturnValue({ isConnected: true, address: W });
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse({ balance: 7, dailyEarnedCapped: 3, dailyCap: 10 }),
    );

    renderHook(() => usePeonesBalance({ fetchImpl }));
    await waitFor(() => expect(fetchImpl).toHaveBeenCalledTimes(1));

    // Wait a beat — there's no interval, so the count stays at 1.
    await new Promise((r) => setTimeout(r, 60));
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});
