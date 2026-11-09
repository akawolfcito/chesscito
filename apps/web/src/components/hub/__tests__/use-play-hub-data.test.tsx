import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
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
    expect(result.current.mintedVictoryCount).toBe(0);
    expect(result.current.isLoadingVictories).toBe(false);
  });

  it("uses the number of returned Victory NFT rows", async () => {
    useAccountMock.mockReturnValue({ address: ADDRESS, isConnected: true });
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => [{ tokenId: "1" }, { tokenId: "2" }],
    });

    const { result } = renderHook(() => usePlayHubData());

    await waitFor(() => expect(result.current.mintedVictoryCount).toBe(2));
    expect(fetchMock).toHaveBeenCalledWith(
      `/api/my-victories?player=${ADDRESS}`,
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it("keeps zero as the real count for an empty response", async () => {
    useAccountMock.mockReturnValue({ address: ADDRESS, isConnected: true });
    fetchMock.mockResolvedValue({ ok: true, json: async () => [] });

    const { result } = renderHook(() => usePlayHubData());

    await waitFor(() => expect(result.current.isLoadingVictories).toBe(false));
    expect(result.current.mintedVictoryCount).toBe(0);
    expect(result.current.victoriesError).toBe(false);
  });
});
