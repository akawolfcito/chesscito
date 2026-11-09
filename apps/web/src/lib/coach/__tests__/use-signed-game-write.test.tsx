import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useSignedGameWrite } from "../use-signed-game-write";

const state = vi.hoisted(() => ({ address: `0x${"1".repeat(40)}`, chainId: 42220, sign: vi.fn() }));
vi.mock("wagmi", () => ({
  useAccount: () => ({ address: state.address }),
  useChainId: () => state.chainId,
  useSignMessage: () => ({ signMessageAsync: state.sign }),
}));
const wallet = `0x${"1".repeat(40)}` as `0x${string}`;
const args = { path: "/api/games", wallet, gameId: "550e8400-e29b-41d4-a716-446655440000", payload: { fixture: true } };
describe("game write wallet binding", () => {
  beforeEach(() => {
    state.address = wallet;
    state.chainId = 42220;
    state.sign.mockReset().mockResolvedValue(`0x${"ab".repeat(65)}`);
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 200 })));
  });
  afterEach(() => vi.unstubAllGlobals());
  it("does not sign on mount; confirms only when the save is requested", async () => {
    const { result } = renderHook(() => useSignedGameWrite());
    expect(state.sign).not.toHaveBeenCalled();
    await act(async () => { await result.current(args); });
    expect(state.sign).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it("rejects another connected wallet or chain without prompting or posting", async () => {
    const { result, rerender } = renderHook(() => useSignedGameWrite());
    state.address = `0x${"2".repeat(40)}`;
    rerender();
    await expect(result.current(args)).rejects.toThrow("game_write_cancelled");
    state.address = wallet;
    state.chainId = 1;
    rerender();
    await expect(result.current(args)).rejects.toThrow("game_write_cancelled");
    expect(state.sign).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });
  it.each(["wallet change", "unmount"])("drops a pending signature after %s", async (change) => {
    let finish!: (signature: `0x${string}`) => void;
    state.sign.mockImplementation(() => new Promise<`0x${string}`>((resolve) => { finish = resolve; }));
    const { result, rerender, unmount } = renderHook(() => useSignedGameWrite());
    const request = result.current(args);
    // Attach a rejection observer before resolving the pending signer.
    const outcome = request.then(() => "posted", (error: Error) => error.message);
    if (change === "unmount") unmount();
    else { state.address = `0x${"2".repeat(40)}`; rerender(); }
    await act(async () => { finish(`0x${"ab".repeat(65)}`); });
    expect(await outcome).toBe("game_write_cancelled");
    expect(fetch).not.toHaveBeenCalled();
  });
});
