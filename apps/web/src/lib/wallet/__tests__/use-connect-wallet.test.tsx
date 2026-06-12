/**
 * useConnectWallet — RainbowKit-free connect affordance (P2, 2026-06-12).
 *
 * Contract:
 *  - connectWallet() triggers wagmi connect with the injected connector
 *    directly (the modal it replaces only ever listed "Browser wallet").
 *  - No injected connector available → silent no-op, never throws
 *    (plain desktop Chrome without an extension).
 *  - Function identity is STABLE across re-renders (hook-ref-stability
 *    hard rule — consumers wire it into effects next to fragile timers).
 */
import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";

const connectMock = vi.fn();
let connectorsMock: Array<{ id: string }> = [{ id: "injected" }];
let isPendingMock = false;

vi.mock("wagmi", () => ({
  useConnect: () => ({
    connect: connectMock,
    connectors: connectorsMock,
    isPending: isPendingMock,
  }),
}));

import { useConnectWallet } from "../use-connect-wallet";

beforeEach(() => {
  connectMock.mockClear();
  connectorsMock = [{ id: "injected" }];
  isPendingMock = false;
});

describe("useConnectWallet", () => {
  it("connects with the injected connector", () => {
    const { result } = renderHook(() => useConnectWallet());

    result.current.connectWallet();

    expect(connectMock).toHaveBeenCalledTimes(1);
    expect(connectMock.mock.calls[0][0]).toEqual({ connector: connectorsMock[0] });
  });

  it("no-ops without throwing when no injected connector exists", () => {
    connectorsMock = [];
    const { result } = renderHook(() => useConnectWallet());

    expect(() => result.current.connectWallet()).not.toThrow();
    expect(connectMock).not.toHaveBeenCalled();
  });

  it("keeps connectWallet referentially stable across re-renders", () => {
    const { result, rerender } = renderHook(() => useConnectWallet());
    const first = result.current.connectWallet;

    rerender();

    expect(result.current.connectWallet).toBe(first);
  });

  it("exposes wagmi's pending state as isConnecting", () => {
    isPendingMock = true;
    const { result } = renderHook(() => useConnectWallet());

    expect(result.current.isConnecting).toBe(true);
  });
});
