import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { useCoachHistoryCount } from "../use-coach-history-count.js";

const VALID_WALLET = "0x1234567890abcdef1234567890abcdef12345678";

describe("useCoachHistoryCount", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns rowCount=undefined and isLoading=true initially", () => {
    vi.stubGlobal("fetch", vi.fn(() => new Promise(() => {})));
    const { result } = renderHook(() => useCoachHistoryCount(VALID_WALLET));
    expect(result.current.rowCount).toBeUndefined();
    expect(result.current.isLoading).toBe(true);
  });

  it("returns rowCount=N after successful fetch", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve([{ gameId: "g1" }, { gameId: "g2" }, { gameId: "g3" }]),
        }),
      ),
    );
    const { result } = renderHook(() => useCoachHistoryCount(VALID_WALLET));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.rowCount).toBe(3);
  });

  it("returns rowCount=0 on fetch error (fail-soft)", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new Error("network"))));
    const { result } = renderHook(() => useCoachHistoryCount(VALID_WALLET));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.rowCount).toBe(0);
  });

  it("does not fetch when walletAddress is undefined", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const { result } = renderHook(() => useCoachHistoryCount(undefined));
    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.current.rowCount).toBeUndefined();
    expect(result.current.isLoading).toBe(false);
  });

  it("refetch() re-runs the request", async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve([{ gameId: "g1" }]),
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useCoachHistoryCount(VALID_WALLET));
    await waitFor(() => expect(result.current.rowCount).toBe(1));

    act(() => {
      result.current.refetch();
    });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
  });
});
