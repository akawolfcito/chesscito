import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";

const useAccountMock = vi.fn();

vi.mock("wagmi", () => ({
  useAccount: () => useAccountMock(),
}));

import { useCoachCredits } from "../use-coach-credits";

const WALLET = "0x1234567890abcdef1234567890abcdef12345678";
const CACHE_KEY = `chesscito:coach-credits:${WALLET}`;
const TTL_MS = 5 * 60_000;

function mockFetchOk(credits: number): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ credits }),
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function mockFetchError(): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn().mockRejectedValue(new Error("network"));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("useCoachCredits", () => {
  beforeEach(() => {
    useAccountMock.mockReset();
    window.localStorage.clear();
    vi.unstubAllGlobals();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  describe("no wallet", () => {
    it("returns credits=0 and never fires fetch", () => {
      useAccountMock.mockReturnValue({ address: undefined });
      const fetchMock = mockFetchOk(3);

      const { result } = renderHook(() => useCoachCredits());

      expect(result.current.credits).toBe(0);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.isError).toBe(false);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("refetch is a noop when no wallet", async () => {
      useAccountMock.mockReturnValue({ address: undefined });
      const fetchMock = mockFetchOk(3);

      const { result } = renderHook(() => useCoachCredits());
      await act(async () => {
        await result.current.refetch();
      });

      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  describe("first fetch (no cache)", () => {
    it("calls /api/coach/credits with the wallet query param", async () => {
      useAccountMock.mockReturnValue({ address: WALLET });
      const fetchMock = mockFetchOk(3);

      renderHook(() => useCoachCredits());

      await waitFor(() => {
        expect(fetchMock).toHaveBeenCalledWith(
          expect.stringMatching(/\/api\/coach\/credits\?wallet=0x[a-f0-9]{40}$/),
          expect.objectContaining({ method: "GET" }),
        );
      });
    });

    it("normalises the wallet to lowercase in the request", async () => {
      useAccountMock.mockReturnValue({ address: WALLET.toUpperCase() });
      const fetchMock = mockFetchOk(3);

      renderHook(() => useCoachCredits());

      await waitFor(() => {
        expect(fetchMock).toHaveBeenCalledWith(
          expect.stringContaining(`wallet=${WALLET}`),
          expect.anything(),
        );
      });
    });

    it("returns parsed credits once the fetch resolves", async () => {
      useAccountMock.mockReturnValue({ address: WALLET });
      mockFetchOk(3);

      const { result } = renderHook(() => useCoachCredits());

      await waitFor(() => expect(result.current.credits).toBe(3));
      expect(result.current.isLoading).toBe(false);
      expect(result.current.isError).toBe(false);
    });

    it("writes the result through to localStorage with a timestamp", async () => {
      useAccountMock.mockReturnValue({ address: WALLET });
      mockFetchOk(2);

      const { result } = renderHook(() => useCoachCredits());
      await waitFor(() => expect(result.current.credits).toBe(2));

      const raw = window.localStorage.getItem(CACHE_KEY);
      expect(raw).not.toBeNull();
      const parsed = JSON.parse(raw!) as { credits: number; cachedAt: number };
      expect(parsed.credits).toBe(2);
      expect(parsed.cachedAt).toBeGreaterThan(Date.now() - 5_000);
    });
  });

  describe("cache hit (fresh)", () => {
    it("returns the cached value synchronously and skips the fetch", () => {
      window.localStorage.setItem(
        CACHE_KEY,
        JSON.stringify({ credits: 1, cachedAt: Date.now() - 60_000 }),
      );
      useAccountMock.mockReturnValue({ address: WALLET });
      const fetchMock = mockFetchOk(99);

      const { result } = renderHook(() => useCoachCredits());

      expect(result.current.credits).toBe(1);
      expect(result.current.isLoading).toBe(false);
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  describe("cache stale (> 5 min)", () => {
    it("ignores the stale cache and fires a fresh fetch", async () => {
      window.localStorage.setItem(
        CACHE_KEY,
        JSON.stringify({ credits: 1, cachedAt: Date.now() - (TTL_MS + 1_000) }),
      );
      useAccountMock.mockReturnValue({ address: WALLET });
      const fetchMock = mockFetchOk(3);

      const { result } = renderHook(() => useCoachCredits());

      await waitFor(() => expect(fetchMock).toHaveBeenCalled());
      await waitFor(() => expect(result.current.credits).toBe(3));
    });
  });

  describe("refetch()", () => {
    it("bypasses cache TTL and re-fires the request", async () => {
      window.localStorage.setItem(
        CACHE_KEY,
        JSON.stringify({ credits: 3, cachedAt: Date.now() - 1_000 }),
      );
      useAccountMock.mockReturnValue({ address: WALLET });
      const fetchMock = mockFetchOk(2);

      const { result } = renderHook(() => useCoachCredits());

      expect(fetchMock).not.toHaveBeenCalled();
      await act(async () => {
        await result.current.refetch();
      });
      expect(fetchMock).toHaveBeenCalledTimes(1);
      await waitFor(() => expect(result.current.credits).toBe(2));
    });
  });

  describe("fetch error", () => {
    it("flips isError=true and keeps the cached credits if any", async () => {
      window.localStorage.setItem(
        CACHE_KEY,
        JSON.stringify({ credits: 2, cachedAt: Date.now() - (TTL_MS + 1_000) }),
      );
      useAccountMock.mockReturnValue({ address: WALLET });
      mockFetchError();

      const { result } = renderHook(() => useCoachCredits());

      await waitFor(() => expect(result.current.isError).toBe(true));
      expect(result.current.credits).toBe(2);
    });

    it("falls back to 0 when there is no cache to fall back to", async () => {
      useAccountMock.mockReturnValue({ address: WALLET });
      mockFetchError();

      const { result } = renderHook(() => useCoachCredits());

      await waitFor(() => expect(result.current.isError).toBe(true));
      expect(result.current.credits).toBe(0);
    });
  });

  describe("wallet change", () => {
    it("re-keys the cache and re-fetches when the connected wallet changes", async () => {
      const WALLET_B = "0xabcdef1234567890abcdef1234567890abcdef12";
      useAccountMock.mockReturnValue({ address: WALLET });
      const fetchMock = mockFetchOk(3);

      const { result, rerender } = renderHook(() => useCoachCredits());
      await waitFor(() => expect(result.current.credits).toBe(3));

      useAccountMock.mockReturnValue({ address: WALLET_B });
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ credits: 1 }),
      });
      rerender();

      await waitFor(() =>
        expect(fetchMock).toHaveBeenCalledWith(
          expect.stringContaining(`wallet=${WALLET_B}`),
          expect.anything(),
        ),
      );
      await waitFor(() => expect(result.current.credits).toBe(1));
    });
  });
});
