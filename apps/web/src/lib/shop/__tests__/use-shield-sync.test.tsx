import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";

// Mutable wallet state per test — wagmi.useAccount returns it.
let mockAccount: { address: `0x${string}` | undefined; isConnected: boolean };

vi.mock("wagmi", () => ({
  useAccount: () => mockAccount,
}));

import {
  enqueuePendingTx,
  readPendingTxs,
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

  // ─── D1: drain pending queue first, then read ────────────────────

  it("AC14: drains queued txHashes before reading /api/shields/me", async () => {
    enqueuePendingTx("0xaa");
    const calls: string[] = [];
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async (input) => {
        const url = typeof input === "string" ? input : (input as Request).url;
        calls.push(url);
        if (url.includes("/api/credit-shield")) {
          return new Response(
            JSON.stringify({ ok: true, credited: 3, delta: 3, txHash: "0xaa" }),
            { status: 200 },
          );
        }
        return new Response(
          JSON.stringify({ ok: true, credited: 3 }),
          { status: 200 },
        );
      });

    const { result } = renderHook(() => useShieldSync());
    await waitFor(() => {
      expect(result.current.serverCredited).toBe(3);
    });

    // Order: credit-shield drain BEFORE shields/me read
    expect(calls[0]).toContain("/api/credit-shield");
    expect(calls[1]).toContain("/api/shields/me");
    // Drained → empty queue
    expect(readPendingTxs()).toEqual([]);
    // Cache populated
    expect(readCreditedCache()).toBe(3);

    fetchSpy.mockRestore();
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

  // ─── D3: 4xx / 5xx leave entry queued ───────────────────────────

  it("AC19: 4xx response from credit-shield leaves the entry queued", async () => {
    enqueuePendingTx("0xaa");
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async (input) => {
        const url = typeof input === "string" ? input : (input as Request).url;
        if (url.includes("/api/credit-shield")) {
          return new Response(
            JSON.stringify({ ok: false, error: "unprocessable" }),
            { status: 400 },
          );
        }
        return new Response(JSON.stringify({ ok: true, credited: 0 }), {
          status: 200,
        });
      });

    renderHook(() => useShieldSync());
    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledTimes(2);
    });

    // Entry must remain queued — collapsed `unprocessable` mixes
    // terminal + transient cases; cannot dequeue. TTL/ring-buffer
    // evicts permanently-bad txs organically.
    const queued = readPendingTxs().map((t) => t.txHash);
    expect(queued).toEqual(["0xaa"]);
    fetchSpy.mockRestore();
  });

  it("AC20: 500 response from credit-shield leaves the entry queued", async () => {
    enqueuePendingTx("0xaa");
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async (input) => {
        const url = typeof input === "string" ? input : (input as Request).url;
        if (url.includes("/api/credit-shield")) {
          return new Response(
            JSON.stringify({ ok: false, error: "internal" }),
            { status: 500 },
          );
        }
        return new Response(JSON.stringify({ ok: true, credited: 0 }), {
          status: 200,
        });
      });

    renderHook(() => useShieldSync());
    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledTimes(2);
    });

    expect(readPendingTxs().map((t) => t.txHash)).toEqual(["0xaa"]);
    fetchSpy.mockRestore();
  });

  it("network error on credit-shield leaves the entry queued", async () => {
    enqueuePendingTx("0xaa");
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async (input) => {
        const url = typeof input === "string" ? input : (input as Request).url;
        if (url.includes("/api/credit-shield")) {
          throw new Error("network down");
        }
        return new Response(JSON.stringify({ ok: true, credited: 0 }), {
          status: 200,
        });
      });

    renderHook(() => useShieldSync());
    await waitFor(() => {
      // shields/me should still be reached — drain failure must not
      // block the read.
      expect(fetchSpy).toHaveBeenCalled();
    });

    expect(readPendingTxs().map((t) => t.txHash)).toEqual(["0xaa"]);
    fetchSpy.mockRestore();
  });

  it("dequeues on 2xx with delta=0 (idempotent retry resolves to terminal)", async () => {
    enqueuePendingTx("0xaa");
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async (input) => {
        const url = typeof input === "string" ? input : (input as Request).url;
        if (url.includes("/api/credit-shield")) {
          return new Response(
            JSON.stringify({ ok: true, credited: 3, delta: 0, txHash: "0xaa" }),
            { status: 200 },
          );
        }
        return new Response(JSON.stringify({ ok: true, credited: 3 }), {
          status: 200,
        });
      });

    renderHook(() => useShieldSync());
    await waitFor(() => {
      expect(readPendingTxs()).toEqual([]);
    });
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
