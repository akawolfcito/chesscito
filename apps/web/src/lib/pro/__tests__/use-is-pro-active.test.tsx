import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";

const useAccountMock = vi.fn();
const useProStatusMock = vi.fn();

vi.mock("wagmi", () => ({
  useAccount: () => useAccountMock(),
}));

vi.mock("../use-pro-status", () => ({
  useProStatus: (wallet?: string) => useProStatusMock(wallet),
}));

import {
  proDisplayState,
  useIsProActive,
  useProEntitlement,
} from "../use-is-pro-active";
import type {
  ProRemoteState,
  ProStatus,
  ProStatusError,
} from "../use-pro-status";

const WALLET = "0x1234567890abcdef1234567890abcdef12345678";
const FUTURE = Date.now() + 30 * 86_400_000;
const PAST = Date.now() - 60 * 60 * 1000;

function setRemote(value: {
  state: ProRemoteState;
  status?: ProStatus | null;
  staleStatus?: ProStatus | null;
  error?: ProStatusError | null;
}) {
  useProStatusMock.mockReturnValue({
    state: value.state,
    status: value.status ?? null,
    staleStatus: value.staleStatus ?? null,
    error: value.error ?? null,
    isLoading: value.state === "loading",
    refetch: vi.fn(),
  });
}

describe("useIsProActive hardening", () => {
  beforeEach(() => {
    useAccountMock.mockReset();
    useProStatusMock.mockReset();
    window.localStorage.clear();
  });

  it("makes no inactive claim when no wallet is connected", () => {
    useAccountMock.mockReturnValue({ address: undefined });
    setRemote({ state: "unknown" });

    const { result } = renderHook(() => useProEntitlement());

    expect(result.current).toEqual({
      status: "unknown",
      active: false,
      loading: false,
      expiresAt: null,
      stale: null,
      error: null,
    });
  });

  it("authorizes only a successful active response with a future expiry", () => {
    useAccountMock.mockReturnValue({ address: WALLET });
    setRemote({
      state: "active",
      status: { active: true, expiresAt: FUTURE },
    });

    const { result } = renderHook(() => useProEntitlement());

    expect(result.current).toMatchObject({
      status: "active",
      active: true,
      expiresAt: FUTURE,
      stale: null,
    });
    expect(useIsProActive).toBeTypeOf("function");
  });

  it("maps a successful inactive response to confirmed inactive", () => {
    useAccountMock.mockReturnValue({ address: WALLET });
    setRemote({
      state: "inactive",
      status: { active: false, expiresAt: null },
    });

    const { result } = renderHook(() => useProEntitlement());

    expect(result.current.status).toBe("inactive");
    expect(result.current.active).toBe(false);
  });

  it("does not authorize an already-expired active response", () => {
    useAccountMock.mockReturnValue({ address: WALLET });
    setRemote({
      state: "active",
      status: { active: true, expiresAt: PAST },
    });

    const { result } = renderHook(() => useIsProActive());

    expect(result.current).toBe(false);
  });

  it("keeps a legacy cache as stale metadata while loading, never authorization", () => {
    window.localStorage.setItem(`chesscito:pro-active:${WALLET}`, "1");
    useAccountMock.mockReturnValue({ address: WALLET });
    setRemote({ state: "loading" });

    const { result } = renderHook(() => useProEntitlement());

    expect(result.current).toEqual({
      status: "loading",
      active: false,
      loading: true,
      expiresAt: null,
      stale: { source: "local-cache", active: true, expiresAt: null },
      error: null,
    });
    expect(proDisplayState(result.current)).toEqual({
      status: "loading",
      active: false,
      staleVisualActive: false,
    });
  });

  it("active to HTTP error removes authorization but exposes stale visual metadata", () => {
    useAccountMock.mockReturnValue({ address: WALLET });
    setRemote({
      state: "error",
      staleStatus: { active: true, expiresAt: FUTURE },
      error: {
        kind: "http",
        httpStatus: 403,
        message: "PRO status request failed (403)",
      },
    });

    const { result } = renderHook(() => useProEntitlement());

    expect(result.current.active).toBe(false);
    expect(result.current.status).toBe("error");
    expect(result.current.stale).toEqual({
      source: "server",
      active: true,
      expiresAt: FUTURE,
    });
    expect(proDisplayState(result.current)).toEqual({
      status: "error",
      active: false,
      staleVisualActive: true,
    });
  });

  it("inactive to network error stays non-authorizing without a false inactive claim", () => {
    useAccountMock.mockReturnValue({ address: WALLET });
    setRemote({
      state: "unknown",
      staleStatus: { active: false, expiresAt: null },
      error: {
        kind: "network",
        httpStatus: null,
        message: "PRO status network request failed",
      },
    });

    const { result } = renderHook(() => useProEntitlement());

    expect(result.current.status).toBe("unknown");
    expect(result.current.active).toBe(false);
    expect(result.current.stale).toEqual({
      source: "server",
      active: false,
      expiresAt: null,
    });
    expect(proDisplayState(result.current).status).toBe("unknown");
  });

  it("writes successful active truth and clears only after successful inactive truth", () => {
    useAccountMock.mockReturnValue({ address: WALLET });
    setRemote({
      state: "active",
      status: { active: true, expiresAt: FUTURE },
    });
    const { rerender } = renderHook(() => useProEntitlement());
    expect(localStorage.getItem(`chesscito:pro-active:${WALLET}`)).toBe(
      String(FUTURE),
    );

    setRemote({
      state: "inactive",
      status: { active: false, expiresAt: null },
    });
    rerender();
    expect(localStorage.getItem(`chesscito:pro-active:${WALLET}`)).toBeNull();
  });
});
