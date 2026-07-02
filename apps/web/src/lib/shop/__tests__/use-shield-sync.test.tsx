import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";

// Mutable wallet state per test — wagmi.useAccount returns it.
let mockAccount: { address: `0x${string}` | undefined; isConnected: boolean };

vi.mock("wagmi", () => ({
  useAccount: () => mockAccount,
}));

import {
  readCreditedCache,
  SHIELDS_LEGACY_KEY,
  SHIELDS_CONSUMED_KEY,
} from "@/lib/shop/shield-storage";
import { useShieldSync } from "@/lib/shop/use-shield-sync";

const WALLET = "0xcc4179a22b473ea2eb2b9b9b210458d0f60fc2dd" as const;

describe("useShieldSync", () => {
  beforeEach(() => {
    mockAccount = { address: WALLET, isConnected: true };
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("does nothing when wallet is not connected", async () => {
    mockAccount = { address: undefined, isConnected: false };
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const { result } = renderHook(() => useShieldSync());
    // serverCredited stays null forever for a disconnected wallet.
    await Promise.resolve();
    expect(result.current.serverCredited).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  // ─── D2: re-entry guard ──────────────────────────────────────────

  it("AC23: two synchronous refresh() calls produce exactly one network request", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(
        async () =>
          new Response(JSON.stringify({ ok: true, credited: 0 }), {
            status: 200,
          }),
      );

    const { result } = renderHook(() => useShieldSync());
    await waitFor(() => expect(result.current.serverCredited).toBe(0));
    fetchSpy.mockClear();

    // Fire two refresh() calls back-to-back — second must short-circuit.
    await act(async () => {
      const a = result.current.refresh();
      const b = result.current.refresh();
      await Promise.all([a, b]);
    });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    fetchSpy.mockRestore();
  });

  // ─── legacy migration (forfeit-and-clear) ───────────────────────

  it("forfeits legacy shields on first sync and clears the legacy key", async () => {
    window.localStorage.setItem(SHIELDS_LEGACY_KEY, "5");
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async () =>
        new Response(JSON.stringify({ ok: true, credited: 0 }), {
          status: 200,
        }),
      );

    renderHook(() => useShieldSync());
    await waitFor(() => {
      // Migration ran exactly once.
      expect(window.localStorage.getItem(SHIELDS_LEGACY_KEY)).toBeNull();
    });
    expect(window.localStorage.getItem(SHIELDS_CONSUMED_KEY)).toBe("0");
    expect(readCreditedCache()).toBe(0);
    fetchSpy.mockRestore();
  });
});
