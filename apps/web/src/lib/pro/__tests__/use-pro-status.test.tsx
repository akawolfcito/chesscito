import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

import { useProStatus } from "../use-pro-status";

const VALID_WALLET = "0xcc4179a22b473ea2eb2b9b9b210458d0f60fc2dd";

describe("useProStatus", () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  let queryClient: QueryClient;
  let wrapper: ({ children }: { children: ReactNode }) => React.JSX.Element;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: 0 } },
    });
    wrapper = ({ children }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("returns null status without fetching when wallet is undefined", () => {
    const { result } = renderHook(() => useProStatus(undefined), { wrapper });

    expect(result.current.status).toBeNull();
    expect(result.current.isLoading).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("fetches /api/pro/status on mount and exposes the parsed body", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ active: true, expiresAt: 1_700_000_000_000 }),
    });

    const { result } = renderHook(() => useProStatus(VALID_WALLET), { wrapper });

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

    const { result } = renderHook(() => useProStatus(VALID_WALLET), { wrapper });

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

  it("leaves status null on a first-load non-ok response (cache layer decides)", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 403,
      json: async () => ({ error: "Forbidden" }),
    });

    const { result } = renderHook(() => useProStatus(VALID_WALLET), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    expect(result.current.status).toBeNull();
  });

  it("leaves status null on a first-load network error (cache layer decides)", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("network down"));

    const { result } = renderHook(() => useProStatus(VALID_WALLET), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    expect(result.current.status).toBeNull();
  });

  it("preserves an active status when a refetch hits a non-ok response (no false PRO demotion)", async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ active: true, expiresAt: 9_999_999_999_999 }),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 403,
        json: async () => ({ error: "Forbidden" }),
      });

    const { result } = renderHook(() => useProStatus(VALID_WALLET), { wrapper });

    await waitFor(() => {
      expect(result.current.status).toEqual({ active: true, expiresAt: 9_999_999_999_999 });
    });

    act(() => {
      result.current.refetch();
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    expect(result.current.status).toEqual({ active: true, expiresAt: 9_999_999_999_999 });
  });

  it("preserves an active status when a refetch throws a network error", async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ active: true, expiresAt: 9_999_999_999_999 }),
      })
      .mockRejectedValueOnce(new TypeError("network down"));

    const { result } = renderHook(() => useProStatus(VALID_WALLET), { wrapper });

    await waitFor(() => {
      expect(result.current.status).toEqual({ active: true, expiresAt: 9_999_999_999_999 });
    });

    act(() => {
      result.current.refetch();
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    expect(result.current.status).toEqual({ active: true, expiresAt: 9_999_999_999_999 });
  });

  it("downgrades to inactive when an OK response reports active:false (real lapse)", async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ active: true, expiresAt: 9_999_999_999_999 }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ active: false, expiresAt: null }),
      });

    const { result } = renderHook(() => useProStatus(VALID_WALLET), { wrapper });

    await waitFor(() => {
      expect(result.current.status).toEqual({ active: true, expiresAt: 9_999_999_999_999 });
    });

    act(() => {
      result.current.refetch();
    });

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

    const { unmount } = renderHook(() => useProStatus(VALID_WALLET), { wrapper });
    expect(captured.signal?.aborted).toBe(false);
    unmount();
    expect(captured.signal?.aborted).toBe(true);
  });

  it("shares one authoritative status across observers and refetches", async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ active: false, expiresAt: null }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ active: true, expiresAt: 9_999_999_999_999 }),
      });

    const { result } = renderHook(
      () => ({
        provider: useProStatus(VALID_WALLET),
        purchaseFlow: useProStatus(VALID_WALLET),
      }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.provider.status?.active).toBe(false));
    expect(fetchMock).toHaveBeenCalledTimes(1);

    act(() => result.current.purchaseFlow.refetch());

    await waitFor(() => expect(result.current.provider.status?.active).toBe(true));
    expect(result.current.purchaseFlow.status?.active).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("normalizes checksum casing so every route observes one query", async () => {
    const checksumWallet = "0xCc4179A22B473EA2EB2B9B9B210458D0F60FC2DD";
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ active: true, expiresAt: 9_999_999_999_999 }),
    });

    const { result } = renderHook(
      () => ({
        provider: useProStatus(VALID_WALLET),
        hub: useProStatus(checksumWallet),
      }),
      { wrapper },
    );

    await waitFor(() => expect(result.current.provider.status?.active).toBe(true));
    expect(result.current.hub.status?.active).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      `/api/pro/status?wallet=${VALID_WALLET}`,
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });
});
