import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";

import { useProStatus } from "../use-pro-status";

const VALID_WALLET = "0xcc4179a22b473ea2eb2b9b9b210458d0f60fc2dd";

describe("useProStatus", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("returns null status without fetching when wallet is undefined", () => {
    const { result } = renderHook(() => useProStatus(undefined));

    expect(result.current.status).toBeNull();
    expect(result.current.isLoading).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("fetches /api/pro/status on mount and exposes the parsed body", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ active: true, expiresAt: 1_700_000_000_000 }),
    });

    const { result } = renderHook(() => useProStatus(VALID_WALLET));

    expect(fetchMock).toHaveBeenCalledWith(
      `/api/pro/status?wallet=${VALID_WALLET}`,
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );

    await waitFor(() => {
      expect(result.current.status).toEqual({ active: true, expiresAt: 1_700_000_000_000 });
      expect(result.current.isLoading).toBe(false);
    });
  });

  it("re-fetches when refetch() is called", async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ active: false, expiresAt: null }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ active: true, expiresAt: 9_999_999_999_999 }),
      });

    const { result } = renderHook(() => useProStatus(VALID_WALLET));

    await waitFor(() => {
      expect(result.current.status).toEqual({ active: false, expiresAt: null });
    });

    act(() => {
      result.current.refetch();
    });

    await waitFor(() => {
      expect(result.current.status).toEqual({ active: true, expiresAt: 9_999_999_999_999 });
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("treats non-ok responses as inactive without throwing", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 403,
      json: async () => ({ error: "Forbidden" }),
    });

    const { result } = renderHook(() => useProStatus(VALID_WALLET));

    await waitFor(() => {
      expect(result.current.status).toEqual({ active: false, expiresAt: null });
    });
  });

  it("treats network errors as inactive without throwing", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("network down"));

    const { result } = renderHook(() => useProStatus(VALID_WALLET));

    await waitFor(() => {
      expect(result.current.status).toEqual({ active: false, expiresAt: null });
    });
  });

  it("aborts the in-flight request on unmount", () => {
    const captured: { signal: AbortSignal | null } = { signal: null };
    fetchMock.mockImplementation((_url: string, init: RequestInit) => {
      captured.signal = (init.signal as AbortSignal) ?? null;
      return new Promise(() => {
        /* never resolves — we only care about abort */
      });
    });

    const { unmount } = renderHook(() => useProStatus(VALID_WALLET));
    expect(captured.signal?.aborted).toBe(false);
    unmount();
    expect(captured.signal?.aborted).toBe(true);
  });
});
