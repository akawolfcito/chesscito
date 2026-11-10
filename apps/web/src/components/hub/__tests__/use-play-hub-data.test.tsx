import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { usePlayHubData } from "../use-play-hub-data";

const useAccountMock = vi.hoisted(() => vi.fn());
const fetchMock = vi.hoisted(() => vi.fn());

vi.mock("wagmi", () => ({
  useAccount: () => useAccountMock(),
}));

const ADDRESS = "0xcc4179a22b473ea2eb2b9b9b210458d0f60fc2dd";

describe("usePlayHubData", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockReset();
    useAccountMock.mockReturnValue({ address: undefined, isConnected: false });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("does not request victories without a connected wallet", () => {
    const { result } = renderHook(() => usePlayHubData());

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.current).toEqual({ address: undefined, isConnected: false });
  });

  it("keeps connected hub mounts and wallet changes free of history requests", () => {
    useAccountMock.mockReturnValue({ address: ADDRESS, isConnected: true });
    const view = renderHook(() => usePlayHubData());
    expect(view.result.current).toEqual({ address: ADDRESS, isConnected: true });
    useAccountMock.mockReturnValue({ address: undefined, isConnected: false });
    view.rerender();
    expect(view.result.current.isConnected).toBe(false);
    view.unmount();
    useAccountMock.mockReturnValue({ address: ADDRESS, isConnected: true });
    renderHook(() => usePlayHubData());
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
