import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook } from "@testing-library/react";

const useAccountMock = vi.fn();
const useProStatusMock = vi.fn();

vi.mock("wagmi", () => ({
  useAccount: () => useAccountMock(),
}));

vi.mock("../use-pro-status", () => ({
  useProStatus: (wallet?: string) => useProStatusMock(wallet),
}));

import { useIsProActive } from "../use-is-pro-active";

const WALLET = "0x1234567890abcdef1234567890abcdef12345678";
const FUTURE = Date.now() + 30 * 86_400_000;
const PAST = Date.now() - 60 * 60 * 1000;

function setStatus(value: {
  status: { active: boolean; expiresAt: number | null } | null;
}) {
  useProStatusMock.mockReturnValue({
    ...value,
    isLoading: false,
    refetch: vi.fn(),
  });
}

describe("useIsProActive", () => {
  beforeEach(() => {
    useAccountMock.mockReset();
    useProStatusMock.mockReset();
    window.localStorage.clear();
  });

  it("returns false when no wallet is connected", () => {
    useAccountMock.mockReturnValue({ address: undefined });
    setStatus({ status: null });
    const { result } = renderHook(() => useIsProActive());
    expect(result.current).toBe(false);
  });

  it("returns false when the server reports active=false", () => {
    useAccountMock.mockReturnValue({ address: WALLET });
    setStatus({ status: { active: false, expiresAt: null } });
    const { result } = renderHook(() => useIsProActive());
    expect(result.current).toBe(false);
  });

  it("returns true when the server reports active=true with a future expiry", () => {
    useAccountMock.mockReturnValue({ address: WALLET });
    setStatus({ status: { active: true, expiresAt: FUTURE } });
    const { result } = renderHook(() => useIsProActive());
    expect(result.current).toBe(true);
  });

  it("returns false when the server reports active=true but expiresAt is already in the past", () => {
    // Defense-in-depth — the API caches status briefly; the client must
    // re-check expiry against the current clock so a "just-lapsed" pass
    // doesn't paint as active.
    useAccountMock.mockReturnValue({ address: WALLET });
    setStatus({ status: { active: true, expiresAt: PAST } });
    const { result } = renderHook(() => useIsProActive());
    expect(result.current).toBe(false);
  });

  it("returns the cached active value while the server is still loading", () => {
    window.localStorage.setItem(`chesscito:pro-active:${WALLET}`, "1");
    useAccountMock.mockReturnValue({ address: WALLET });
    setStatus({ status: null });
    const { result } = renderHook(() => useIsProActive());
    expect(result.current).toBe(true);
  });

  it("writes through to localStorage when the server answer says active", () => {
    useAccountMock.mockReturnValue({ address: WALLET });
    setStatus({ status: { active: true, expiresAt: FUTURE } });
    renderHook(() => useIsProActive());
    expect(
      window.localStorage.getItem(`chesscito:pro-active:${WALLET}`),
    ).toBe("1");
  });

  it("clears the cache when the server answer says inactive", () => {
    window.localStorage.setItem(`chesscito:pro-active:${WALLET}`, "1");
    useAccountMock.mockReturnValue({ address: WALLET });
    setStatus({ status: { active: false, expiresAt: null } });
    renderHook(() => useIsProActive());
    expect(
      window.localStorage.getItem(`chesscito:pro-active:${WALLET}`),
    ).toBeNull();
  });

  it("normalizes the wallet to lowercase for the cache key", () => {
    const upper = WALLET.toUpperCase();
    useAccountMock.mockReturnValue({ address: upper });
    setStatus({ status: { active: true, expiresAt: FUTURE } });
    renderHook(() => useIsProActive());
    expect(
      window.localStorage.getItem(`chesscito:pro-active:${WALLET}`),
    ).toBe("1");
  });
});
