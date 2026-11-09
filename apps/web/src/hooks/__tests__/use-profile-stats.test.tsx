import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useProfileStats } from "@/hooks/use-profile-stats";

const mockFetch = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", mockFetch);
  mockFetch.mockReset();
});
afterEach(() => vi.unstubAllGlobals());

describe("useProfileStats", () => {
  it("returns null stats when address is undefined", () => {
    const { result } = renderHook(() => useProfileStats(undefined));
    expect(result.current.stats).toBeNull();
    expect(result.current.isLoading).toBe(false);
  });

  it("fetches stats when address is present", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ trophies: 12, arenaWins: 5, nftsMinted: 4, dailyStreak: 14, puzzlesSolved: 87 }),
    } as Response);

    const { result } = renderHook(() => useProfileStats("0x0924abcdef1234567890abcdef1234567890eba4"));
    expect(result.current.isLoading).toBe(true);
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.stats).toMatchObject({ trophies: 12 });
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/profile/stats?address=0x0924"),
      expect.any(Object),
    );
  });

  it("captures error on non-OK response", async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 500 } as Response);
    const { result } = renderHook(() => useProfileStats("0x0924abcdef1234567890abcdef1234567890eba4"));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.error).toBeTruthy();
    expect(result.current.stats).toBeNull();
  });
});
