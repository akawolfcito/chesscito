import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useMintVictory } from "../use-mint-victory";

// ── next-intl mock (#118: hook now reads useTranslations for error i18n) ─────
vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => "en",
}));

// ── wagmi mocks ───────────────────────────────────────────────────────────────
vi.mock("wagmi", () => ({
  useAccount: () => ({ address: undefined, isConnected: false }),
  useChainId: () => 42220,
  usePublicClient: () => null,
  useReadContracts: () => ({ data: undefined }),
  useWriteContract: () => ({ writeContractAsync: vi.fn() }),
}));

// ── viem mock ─────────────────────────────────────────────────────────────────
vi.mock("viem", async (importOriginal) => {
  const actual = await importOriginal<typeof import("viem")>();
  return {
    ...actual,
    decodeEventLog: vi.fn(() => {
      throw new Error("not our event");
    }),
  };
});

// ── fetch mock (sign-victory endpoint) ────────────────────────────────────────
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

beforeEach(() => {
  mockFetch.mockReset();
  sessionStorage.clear();
  // Default: sign-victory returns a valid payload
  mockFetch.mockResolvedValue({
    ok: true,
    json: async () => ({
      nonce: "1",
      deadline: String(Math.floor(Date.now() / 1000) + 300),
      signature: ("0x" + "ab".repeat(65)) as `0x${string}`,
    }),
  });
});

describe("useMintVictory", () => {
  const baseInput = {};

  // ── existing stub tests (kept) ─────────────────────────────────────────────

  it("starts in ready phase, empty claimData", () => {
    const { result } = renderHook(() => useMintVictory(baseInput));
    expect(result.current.phase).toBe("ready");
    expect(result.current.data.tokenId).toBeNull();
    expect(result.current.shareStatus).toBe("locked");
    expect(result.current.error).toBeNull();
  });

  it("returned callbacks are referentially stable across re-renders", () => {
    const { result, rerender } = renderHook((p) => useMintVictory(p), {
      initialProps: baseInput,
    });
    const start = result.current.start;
    const reset = result.current.reset;
    rerender(baseInput);
    expect(result.current.start).toBe(start);
    expect(result.current.reset).toBe(reset);
  });

  // ── new tests (T6b) ────────────────────────────────────────────────────────

  it("start with injected sendMint+waitReceipt: ready → claiming → success", async () => {
    const txHash = ("0x" + "ce".repeat(32)) as `0x${string}`;
    const sendApprove = vi.fn().mockResolvedValue(("0x" + "01".repeat(32)) as `0x${string}`);
    const sendMint = vi.fn().mockResolvedValue(txHash);
    const waitReceipt = vi.fn().mockResolvedValue({
      status: "success",
      logs: [
        {
          // Transfer log shape — decodeEventLog will throw (not our event), which is fine
          topics: [
            "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef",
            "0x0000000000000000000000000000000000000000000000000000000000000000",
            "0x0000000000000000000000001111111111111111111111111111111111111111",
          ],
          data: ("0x" + "01".padStart(64, "0")) as `0x${string}`,
        },
      ],
    });

    // sign-victory fetch succeeds; cache-victory is fire-and-forget
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          nonce: "42",
          deadline: String(Math.floor(Date.now() / 1000) + 300),
          signature: ("0x" + "ab".repeat(65)) as `0x${string}`,
        }),
      })
      .mockResolvedValue({ ok: true, json: async () => ({}) });

    const { result } = renderHook(() =>
      useMintVictory({
        gameId: "550e8400-e29b-41d4-a716-446655440000",
        walletAddress: "0x1111111111111111111111111111111111111111",
        difficulty: "easy",
        result: "win",
        totalMoves: 12,
        elapsedMs: 60_000,
        injected: {
          address: "0x1111111111111111111111111111111111111111",
          chainId: 42220,
          sendApprove,
          sendMint,
          waitReceipt,
        },
      }),
    );

    await act(async () => {
      await result.current.start();
    });

    await waitFor(() =>
      expect(["success", "claiming"]).toContain(result.current.phase),
    );

    expect(sendMint).toHaveBeenCalledTimes(1);
    expect(waitReceipt).toHaveBeenCalledWith(txHash);
  });

  // F8 — non-win outcomes are saveable. The canClaim guard no longer
  // requires result === "win"; a loss reaches claiming/success like a win.
  it("start with a non-win result (lose) reaches claiming/success", async () => {
    const txHash = ("0x" + "ce".repeat(32)) as `0x${string}`;
    const sendApprove = vi.fn().mockResolvedValue(("0x" + "01".repeat(32)) as `0x${string}`);
    const sendMint = vi.fn().mockResolvedValue(txHash);
    const waitReceipt = vi.fn().mockResolvedValue({ status: "success", logs: [] });

    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          nonce: "42",
          deadline: String(Math.floor(Date.now() / 1000) + 300),
          signature: ("0x" + "ab".repeat(65)) as `0x${string}`,
        }),
      })
      .mockResolvedValue({ ok: true, json: async () => ({}) });

    const { result } = renderHook(() =>
      useMintVictory({
        gameId: "550e8400-e29b-41d4-a716-446655440000",
        walletAddress: "0x1111111111111111111111111111111111111111",
        difficulty: "easy",
        result: "lose",
        totalMoves: 18,
        elapsedMs: 90_000,
        injected: {
          address: "0x1111111111111111111111111111111111111111",
          chainId: 42220,
          sendApprove,
          sendMint,
          waitReceipt,
        },
      }),
    );

    await act(async () => {
      await result.current.start();
    });

    await waitFor(() =>
      expect(["success", "claiming"]).toContain(result.current.phase),
    );
    expect(sendMint).toHaveBeenCalledTimes(1);
  });

  it("sig rejection → cancelled phase + claimingRef released", async () => {
    const sendSig = vi.fn().mockRejectedValue(new Error("user rejected"));

    // Override fetch to reject for sign-victory
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: "user rejected" }),
    });

    const { result } = renderHook(() =>
      useMintVictory({
        gameId: "550e8400-e29b-41d4-a716-446655440000",
        walletAddress: "0x1111111111111111111111111111111111111111",
        difficulty: "easy",
        result: "win",
        totalMoves: 12,
        elapsedMs: 60_000,
        injected: {
          address: "0x1111111111111111111111111111111111111111",
          chainId: 42220,
          sendSig,
        },
      }),
    );

    await act(async () => {
      await result.current.start();
    });

    await waitFor(() =>
      expect(["cancelled", "error"]).toContain(result.current.phase),
    );

    // After resolution, reset() must not throw
    expect(() => result.current.reset()).not.toThrow();
  });

  it("reset clears phase + sessionStorage", () => {
    sessionStorage.setItem(
      "chesscito:claim",
      JSON.stringify({ phase: "success" }),
    );

    const { result } = renderHook(() => useMintVictory({}));

    act(() => result.current.reset());

    expect(result.current.phase).toBe("ready");
    expect(sessionStorage.getItem("chesscito:claim")).toBeNull();
  });

  // 2026-05-30: gameId-scoped restore — prevents a saved success from a
  // previous game leaking into the next visor's state (cf. MiniPay smoke
  // bug: Save tile disappeared after phone unlock because the previous
  // game's tokenId hydrated the new game's mint hook).
  it("does NOT restore success when saved gameId differs from input.gameId", () => {
    sessionStorage.setItem(
      "chesscito:claim",
      JSON.stringify({
        phase: "success",
        gameId: "previous-game-id",
        tokenId: "42",
        claimTxHash: "0xabc",
      }),
    );

    const { result } = renderHook(() =>
      useMintVictory({ gameId: "current-game-id" }),
    );

    expect(result.current.phase).toBe("ready");
    expect(result.current.data.tokenId).toBeNull();
    // Stale entry was cleared, not left behind for the next mount.
    expect(sessionStorage.getItem("chesscito:claim")).toBeNull();
  });

  it("does NOT restore legacy success without gameId field", () => {
    sessionStorage.setItem(
      "chesscito:claim",
      JSON.stringify({
        phase: "success",
        tokenId: "42",
        claimTxHash: "0xabc",
      }),
    );

    const { result } = renderHook(() =>
      useMintVictory({ gameId: "some-game-id" }),
    );

    expect(result.current.phase).toBe("ready");
    expect(sessionStorage.getItem("chesscito:claim")).toBeNull();
  });

  it("restores success when saved gameId matches input.gameId", () => {
    sessionStorage.setItem(
      "chesscito:claim",
      JSON.stringify({
        phase: "success",
        gameId: "match-id",
        tokenId: "42",
        claimTxHash: "0xabc",
      }),
    );

    const { result } = renderHook(() =>
      useMintVictory({ gameId: "match-id" }),
    );

    expect(result.current.phase).toBe("success");
    expect(result.current.data.tokenId).toBe(42n);
    expect(result.current.data.claimTxHash).toBe("0xabc");
    expect(result.current.shareStatus).toBe("ready");
  });

  // ── claimingRef idempotency guard ──────────────────────────────────────────
  // Regression-lock: verifies that two rapid start() calls from a single tap
  // only reach the first irreversible side-effect (/api/sign-victory fetch)
  // ONCE. The guard is `if (claimingRef.current) return; claimingRef.current = true;`
  // (use-mint-victory.ts ~lines 326-327). If that guard is removed, fetch fires
  // twice and this test fails.

  it("claimingRef guard: double start() fires sign-victory fetch exactly once", async () => {
    // Keep the first call in-flight by never resolving it — this holds
    // claimingRef.current = true while the second start() races in.
    let resolveFirst!: (v: unknown) => void;
    const inflight = new Promise((res) => { resolveFirst = res; });

    mockFetch.mockReturnValueOnce(inflight);

    const injectedInput = {
      gameId: "idempotency-test",
      result: "win" as const,
      difficulty: "easy" as const,
      totalMoves: 8,
      elapsedMs: 30_000,
      injected: {
        address: "0x2222222222222222222222222222222222222222" as `0x${string}`,
        chainId: 42220,
      },
    };

    const { result } = renderHook(() => useMintVictory(injectedInput));

    await act(async () => {
      // Fire both calls without awaiting between them — simulates a
      // double-tap or a re-render that re-invokes the handler.
      const first = result.current.start();
      const second = result.current.start();

      // Unblock the first call so the hook can settle
      resolveFirst({
        ok: false,
        json: async () => ({ error: "unblocked" }),
      });

      await Promise.all([first, second]);
    });

    // sign-victory must have been called EXACTLY once, not twice.
    const signCalls = mockFetch.mock.calls.filter(
      ([url]) => url === "/api/sign-victory",
    );
    expect(signCalls).toHaveLength(1);
  });

  it("claimingRef guard: resets after completion, allowing a deliberate second start()", async () => {
    // After the first complete start() cycle, the guard must release so a
    // user who intentionally tries again (e.g. after an error + reset) is
    // NOT blocked.
    const txHash = ("0x" + "dd".repeat(32)) as `0x${string}`;
    // sendApprove bypasses the publicClient.readContract allowance check
    // (which would crash because wagmi mock returns null for publicClient).
    const sendApprove = vi.fn().mockResolvedValue(("0x" + "00".repeat(32)) as `0x${string}`);
    const sendMint = vi.fn().mockResolvedValue(txHash);
    const waitReceipt = vi.fn().mockResolvedValue({ logs: [] });

    // Two sequential successful sign-victory fetches
    const makeSignResponse = () => ({
      ok: true,
      json: async () => ({
        nonce: "99",
        deadline: String(Math.floor(Date.now() / 1000) + 300),
        signature: ("0x" + "ab".repeat(65)) as `0x${string}`,
      }),
    });
    // sign-victory × 2, then cache-victory × 2 (fire-and-forget)
    mockFetch
      .mockResolvedValueOnce(makeSignResponse())
      .mockResolvedValueOnce({ ok: true, json: async () => ({}) })
      .mockResolvedValueOnce(makeSignResponse())
      .mockResolvedValue({ ok: true, json: async () => ({}) });

    const { result } = renderHook(() =>
      useMintVictory({
        gameId: "guard-reset-test",
        result: "win",
        difficulty: "easy",
        totalMoves: 5,
        elapsedMs: 10_000,
        injected: {
          address: "0x3333333333333333333333333333333333333333" as `0x${string}`,
          chainId: 42220,
          sendApprove,
          sendMint,
          waitReceipt,
        },
      }),
    );

    // First complete cycle
    await act(async () => { await result.current.start(); });
    await waitFor(() => expect(result.current.phase).toBe("success"));

    // Reset so the hook is in "ready" again
    act(() => result.current.reset());
    await waitFor(() => expect(result.current.phase).toBe("ready"));

    // Deliberate second start() — must NOT be blocked by claimingRef
    await act(async () => { await result.current.start(); });

    const signCalls = mockFetch.mock.calls.filter(
      ([url]) => url === "/api/sign-victory",
    );
    // Two complete cycles → two sign calls
    expect(signCalls).toHaveLength(2);
  });
});
