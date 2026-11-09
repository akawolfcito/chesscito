import { act, renderHook } from "@testing-library/react";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { HISTORY_READ_TTL_MS } from "../history-read-message";
import { useHistoryReadAccess, useHistoryReadSessionReset } from "../use-history-read-access";

const state = vi.hoisted(() => ({ address: undefined as string | undefined, chainId: 42220, sign: vi.fn() }));
vi.mock("wagmi", () => ({
  useAccount: () => ({ address: state.address, chainId: state.chainId }),
  useSignMessage: () => ({ signMessageAsync: state.sign }),
}));
const wallet = `0x${"1".repeat(40)}`;
const other = `0x${"2".repeat(40)}`;
describe("private history client authorization", () => {
  beforeEach(() => {
    state.address = undefined;
    state.chainId = 42220;
    const reset = renderHook(() => useHistoryReadAccess());
    reset.unmount();
    state.address = wallet;
    state.sign.mockReset().mockResolvedValue(`0x${"ab".repeat(65)}`);
  });
  afterEach(() => vi.useRealTimers());
  it("requests personal_sign only after explicit confirmation", async () => {
    const { result } = renderHook(() => useHistoryReadAccess(wallet));
    expect(result.current.headers).toBeNull();
    expect(state.sign).not.toHaveBeenCalled();
    await act(async () => { await result.current.authorize(); });
    expect(result.current.headers).not.toBeNull();
    expect(state.sign.mock.calls[0][0].message).toContain("No transactions, payments, or changes authorized.");
    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(0);
  });
  it("clears authorization when the wallet changes", async () => {
    const { result, rerender } = renderHook(() => useHistoryReadAccess(wallet));
    await act(async () => { await result.current.authorize(); });
    state.address = other;
    rerender();
    expect(result.current.headers).toBeNull();
    expect(result.current.canAuthorize).toBe(false);
  });
  it("does not accept a signature completed after disconnect", async () => {
    let finish!: (signature: string) => void;
    state.sign.mockImplementation(() => new Promise<string>((resolve) => { finish = resolve; }));
    const { result, rerender } = renderHook(() => useHistoryReadAccess(wallet));
    let pending!: Promise<void>;
    act(() => { pending = result.current.authorize(); });
    state.address = undefined;
    rerender();
    await act(async () => { finish(`0x${"ab".repeat(65)}`); await pending; });
    expect(result.current.headers).toBeNull();
  });
  it("expires authorization after five minutes", async () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useHistoryReadAccess(wallet));
    await act(async () => { await result.current.authorize(); });
    expect(result.current.headers).not.toBeNull();
    act(() => vi.advanceTimersByTime(HISTORY_READ_TTL_MS));
    expect(result.current.headers).toBeNull();
  });
  it("clears the grant on logout even when the history reader is unmounted", async () => {
    const session = renderHook(() => useHistoryReadSessionReset());
    const reader = renderHook(() => useHistoryReadAccess(wallet));
    await act(async () => { await reader.result.current.authorize(); });
    reader.unmount();
    state.address = undefined;
    session.rerender();
    state.address = wallet;
    session.rerender();
    const nextReader = renderHook(() => useHistoryReadAccess(wallet));
    expect(nextReader.result.current.headers).toBeNull();
  });
  it("does not publish a signature completed after the requesting reader unmounts", async () => {
    let finish!: (signature: string) => void;
    state.sign.mockImplementation(() => new Promise<string>((resolve) => { finish = resolve; }));
    const reader = renderHook(() => useHistoryReadAccess(wallet));
    let pending!: Promise<void>;
    act(() => { pending = reader.result.current.authorize(); });
    reader.unmount();
    await act(async () => { finish(`0x${"ab".repeat(65)}`); await pending; });
    const nextReader = renderHook(() => useHistoryReadAccess(wallet));
    expect(nextReader.result.current.headers).toBeNull();
  });
  it("keeps reads locked after rejection or on another chain", async () => {
    state.sign.mockRejectedValue(new Error("rejected"));
    const { result, rerender } = renderHook(() => useHistoryReadAccess(wallet));
    await act(async () => { await result.current.authorize(); });
    expect(result.current.headers).toBeNull();
    expect(result.current.error).toBe(true);
    state.chainId = 1;
    rerender();
    expect(result.current.canAuthorize).toBe(false);
  });
});
