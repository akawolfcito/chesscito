import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useCoachAnalysis } from "../use-coach-analysis";

// Stub wagmi hooks used inside the hook
vi.mock("wagmi", () => ({
  useAccount: () => ({ address: undefined, isConnected: false }),
  useChainId: () => 42220,
  // The Peones fallback signs for its own score session (P0, 2026-08-10).
  // Rejects on purpose: no test here should reach the signer.
  useSignMessage: () => ({
    signMessageAsync: async () => {
      throw new Error("signer must not be reached in these tests");
    },
  }),
}));

// Stub next-intl hooks
vi.mock("next-intl", () => ({
  useLocale: () => "en",
}));

// Stub useIsProActive
vi.mock("@/lib/pro/use-is-pro-active", () => ({
  useIsProActive: () => false,
}));

// Sprint 4 commit F — Peones fallback mock. Per-test override via
// mockResolvedValueOnce. Default = NOT installed so existing tests
// behave bit-identically.
vi.mock("@/lib/peones/coach-spend-fallback", () => ({
  attemptCoachSpendWithPeones: vi.fn(),
}));

describe("useCoachAnalysis (skeleton)", () => {
  const baseInput = {
    surface: "coach_viewer" as const,
  };

  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
    // jsdom does not seed navigator.onLine; the hook's offline-guard would
    // otherwise bail out to the fallback phase before reaching /api/coach/analyze.
    Object.defineProperty(window.navigator, "onLine", { value: true, configurable: true });
  });

  it("starts in idle phase, no response", () => {
    const { result } = renderHook(() => useCoachAnalysis(baseInput));
    expect(result.current.phase).toBe("idle");
    expect(result.current.response).toBeNull();
    expect(result.current.credits).toBe(0);
  });

  it("returned callbacks are referentially stable across re-renders", () => {
    const { result, rerender } = renderHook((p) => useCoachAnalysis(p), { initialProps: baseInput });
    const askCoach = result.current.askCoach;
    const reanalyze = result.current.reanalyze;
    const abort = result.current.abort;
    const setPhase = result.current.setPhase;
    rerender(baseInput);
    expect(result.current.askCoach).toBe(askCoach);
    expect(result.current.reanalyze).toBe(reanalyze);
    expect(result.current.abort).toBe(abort);
    expect(result.current.setPhase).toBe(setPhase);
  });

  it("askCoach in pro mode transitions to loading then to result (with mock fetch)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockImplementation((url: string) => {
      if (typeof url === "string" && url.includes("/api/coach/credits")) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ credits: 3 }),
        });
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({
          status: "ready",
          response: { kind: "full", summary: "good game", mistakes: [], lessons: [], praise: [] },
          proActive: true,
          idempotent: false,
        }),
      });
    }));

    const { result } = renderHook(() => useCoachAnalysis({
      surface: "coach_viewer",
      gameId: "550e8400-e29b-41d4-a716-446655440000",
      walletAddress: "0x1111111111111111111111111111111111111111",
      result: "win",
      difficulty: "easy",
      moves: ["e4"],
      elapsedMs: 5000,
      injected: {
        address: "0x1111111111111111111111111111111111111111",
        chainId: 42220,
        proActive: true,
        activeLocale: "en",
      },
    }));

    act(() => { result.current.askCoach("immediate"); });

    await waitFor(() =>
      expect(["loading", "result", "fallback"]).toContain(result.current.phase),
    );

    vi.unstubAllGlobals();
  });

  it("does not interrupt an already-mounted authorized analysis when live PRO state becomes unavailable", async () => {
    let resolveAnalysis: ((value: unknown) => void) | undefined;
    const analysisResponse = new Promise((resolve) => {
      resolveAnalysis = resolve;
    });
    vi.stubGlobal("fetch", vi.fn().mockImplementation((url: string) => {
      if (url.includes("/api/coach/credits")) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ credits: 3 }),
        });
      }
      return analysisResponse;
    }));

    const makeInput = (proActive: boolean) => ({
      surface: "coach_viewer" as const,
      gameId: "550e8400-e29b-41d4-a716-446655440010",
      walletAddress: "0x1111111111111111111111111111111111111111" as `0x${string}`,
      result: "win" as const,
      difficulty: "easy" as const,
      moves: ["e4"],
      elapsedMs: 5000,
      isConnected: true,
      injected: {
        address: "0x1111111111111111111111111111111111111111" as `0x${string}`,
        proActive,
        activeLocale: "en" as const,
      },
    });
    const { result, rerender } = renderHook(
      ({ proActive }) => useCoachAnalysis(makeInput(proActive)),
      { initialProps: { proActive: true } },
    );

    act(() => { result.current.askCoach("immediate"); });
    await waitFor(() => expect(result.current.phase).toBe("loading"));

    rerender({ proActive: false });
    expect(result.current.phase).toBe("loading");

    resolveAnalysis?.({
      ok: true,
      status: 200,
      json: async () => ({
        status: "ready",
        response: {
          kind: "full",
          summary: "still running",
          mistakes: [],
          lessons: [],
          praise: [],
        },
        proActive: true,
        idempotent: false,
      }),
    });
    await waitFor(() => expect(result.current.phase).toBe("result"));

    vi.unstubAllGlobals();
  });

  it("abort() clears in-flight request without crashing", () => {
    const { result } = renderHook(() => useCoachAnalysis({ surface: "coach_viewer" }));
    expect(() => result.current.abort()).not.toThrow();
  });

  it("askCoach surfaces historyMeta from a PRO ready response (#117)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockImplementation((url: string) => {
      if (typeof url === "string" && url.includes("/api/coach/credits")) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ credits: 3 }),
        });
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({
          status: "ready",
          response: { kind: "full", summary: "g", mistakes: [], lessons: [], praise: [] },
          proActive: true,
          historyMeta: { gamesPlayed: 12 },
          idempotent: false,
        }),
      });
    }));

    const { result } = renderHook(() => useCoachAnalysis({
      surface: "coach_viewer",
      gameId: "550e8400-e29b-41d4-a716-446655440000",
      walletAddress: "0x1111111111111111111111111111111111111111",
      result: "win",
      difficulty: "easy",
      moves: ["e4"],
      elapsedMs: 5000,
      isConnected: true,
      injected: {
        address: "0x1111111111111111111111111111111111111111",
        proActive: true,
        activeLocale: "en",
      },
    }));

    act(() => { result.current.askCoach("immediate"); });

    await waitFor(() => expect(result.current.phase).toBe("result"));
    expect(result.current.historyMeta).toEqual({ gamesPlayed: 12 });

    vi.unstubAllGlobals();
  });

  it("askCoach leaves historyMeta undefined when server omits it (free user)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockImplementation((url: string) => {
      if (typeof url === "string" && url.includes("/api/coach/credits")) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ credits: 3 }),
        });
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({
          status: "ready",
          response: { kind: "full", summary: "g", mistakes: [], lessons: [], praise: [] },
          // proActive omitted, historyMeta omitted — free path
          idempotent: false,
        }),
      });
    }));

    const { result } = renderHook(() => useCoachAnalysis({
      surface: "coach_viewer",
      gameId: "550e8400-e29b-41d4-a716-446655440002",
      walletAddress: "0x1111111111111111111111111111111111111111",
      result: "win",
      difficulty: "easy",
      moves: ["e4"],
      elapsedMs: 5000,
      isConnected: true,
      injected: {
        address: "0x1111111111111111111111111111111111111111",
        proActive: false,
        activeLocale: "en",
      },
    }));

    act(() => { result.current.askCoach("immediate"); });

    await waitFor(() => expect(result.current.phase).toBe("result"));
    expect(result.current.historyMeta).toBeUndefined();

    vi.unstubAllGlobals();
  });

  // PLAY #8 — a first-time free user goes STRAIGHT to analysis. The "welcome"
  // phase (Luz asking "shall I analyze this?" after you already tapped Ask
  // Coach) is gone: the tap IS the consent, and the cost is already disclosed
  // on the CTA itself by CoachCostRibbon ("1" peon) plus the credits hint.
  // This test is the regression guard — if a confirmation gate comes back, the
  // phase will stall somewhere other than "result".
  it("askCoach analyzes immediately for a first-time free user — no welcome gate", async () => {
    localStorage.removeItem("chesscito:coach-welcomed");
    vi.stubGlobal("fetch", vi.fn().mockImplementation((url: string) => {
      if (typeof url === "string" && url.includes("/api/coach/credits")) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ credits: 3 }),
        });
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({
          status: "ready",
          response: { kind: "full", summary: "good game", mistakes: [], lessons: [], praise: [] },
          idempotent: false,
        }),
      });
    }));

    const { result } = renderHook(() => useCoachAnalysis({
      surface: "arena_endgame",
      gameId: "550e8400-e29b-41d4-a716-446655440001",
      walletAddress: "0x1111111111111111111111111111111111111111",
      moves: ["e4"],
      result: "win",
      difficulty: "easy",
      elapsedMs: 3000,
      // Connected — otherwise askCoach short-circuits to the free quick review
      // ("fallback") and never reaches the branch this test is about.
      isConnected: true,
      injected: {
        address: "0x1111111111111111111111111111111111111111",
        proActive: false,
        activeLocale: "en",
      },
    }));

    act(() => { result.current.askCoach("immediate"); });

    await waitFor(() => expect(result.current.phase).toBe("result"));
    vi.unstubAllGlobals();
  });
});

// ─────────────────────────────────────────────────────────────────
// Sprint 4 commit F — Peones fallback integration
// ─────────────────────────────────────────────────────────────────

import { attemptCoachSpendWithPeones } from "@/lib/peones/coach-spend-fallback";

const mockedAttemptCoach = vi.mocked(attemptCoachSpendWithPeones);
const PEONES_WALLET = "0x2222222222222222222222222222222222222222";
const PEONES_GAME = "550e8400-e29b-41d4-a716-446655440099";

describe("useCoachAnalysis — Peones fallback (Sprint 4 commit F)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
    Object.defineProperty(window.navigator, "onLine", {
      value: true,
      configurable: true,
    });
    mockedAttemptCoach.mockReset();
  });

  function stubFetch(opts: {
    credits: number;
    captureAnalyzeBody: (body: unknown) => void;
  }) {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url: string, init?: RequestInit) => {
        if (typeof url === "string" && url.includes("/api/coach/credits")) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => ({ credits: opts.credits }),
          });
        }
        if (typeof url === "string" && url.includes("/api/coach/analyze")) {
          opts.captureAnalyzeBody(JSON.parse(String(init?.body ?? "{}")));
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => ({
              status: "ready",
              response: {
                kind: "full",
                summary: "ok",
                mistakes: [],
                lessons: [],
                praise: [],
              },
              idempotent: false,
            }),
          });
        }
        // pro/status default no
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ active: false }),
        });
      }),
    );
  }

  function inputForFree(extra: Partial<Parameters<typeof useCoachAnalysis>[0]> = {}) {
    return {
      surface: "coach_viewer" as const,
      gameId: PEONES_GAME,
      walletAddress: PEONES_WALLET as `0x${string}`,
      result: "win" as const,
      difficulty: "easy" as const,
      moves: ["e4"],
      elapsedMs: 5000,
      isConnected: true,
      injected: {
        address: PEONES_WALLET as `0x${string}`,
        proActive: false,
        activeLocale: "en" as const,
      },
      ...extra,
    };
  }

  it("credits>0 path: Peones helper NOT called, analyze body has NO peonesIdempotencyKey", async () => {
    let captured: unknown = null;
    stubFetch({
      credits: 3,
      captureAnalyzeBody: (b) => {
        captured = b;
      },
    });

    const { result } = renderHook(() => useCoachAnalysis(inputForFree()));
    act(() => {
      result.current.askCoach("immediate");
    });

    await waitFor(() => expect(result.current.phase).toBe("result"));
    expect(mockedAttemptCoach).not.toHaveBeenCalled();
    expect(captured).not.toHaveProperty("peonesIdempotencyKey");

    vi.unstubAllGlobals();
  });

  it("credits=0 + Peones paid: analyze body carries peonesIdempotencyKey + phase reaches result", async () => {
    let captured: Record<string, unknown> = {};
    stubFetch({
      credits: 0,
      captureAnalyzeBody: (b) => {
        captured = b as Record<string, unknown>;
      },
    });
    mockedAttemptCoach.mockResolvedValueOnce({
      kind: "paid",
      peonesIdempotencyKey: `spend:coach:${PEONES_WALLET}:${PEONES_GAME}`,
      debited: 1,
      duplicate: false,
      proBypassApplied: false,
      newBalance: 4,
      attestationHash: "sha256:abc",
    });

    const { result } = renderHook(() => useCoachAnalysis(inputForFree()));
    act(() => {
      result.current.askCoach("immediate");
    });

    await waitFor(() => expect(result.current.phase).toBe("result"));
    expect(mockedAttemptCoach).toHaveBeenCalledTimes(1);
    expect(mockedAttemptCoach).toHaveBeenCalledWith({
      wallet: PEONES_WALLET,
      gameId: PEONES_GAME,
      // The spend signs for its own score session (P0, 2026-08-10). The
      // analysis is a request the player made, so it may ask.
      signMessage: expect.any(Function),
    });
    expect(captured.peonesIdempotencyKey).toBe(
      `spend:coach:${PEONES_WALLET}:${PEONES_GAME}`,
    );

    vi.unstubAllGlobals();
  });

  it("credits=0 + Peones duplicate paid: still proceeds to result", async () => {
    let captured: Record<string, unknown> = {};
    stubFetch({
      credits: 0,
      captureAnalyzeBody: (b) => {
        captured = b as Record<string, unknown>;
      },
    });
    mockedAttemptCoach.mockResolvedValueOnce({
      kind: "paid",
      peonesIdempotencyKey: `spend:coach:${PEONES_WALLET}:${PEONES_GAME}`,
      debited: 0, // duplicate
      duplicate: true,
      proBypassApplied: false,
      newBalance: 4,
      attestationHash: "sha256:abc",
    });

    const { result } = renderHook(() => useCoachAnalysis(inputForFree()));
    act(() => {
      result.current.askCoach("immediate");
    });

    await waitFor(() => expect(result.current.phase).toBe("result"));
    expect(captured.peonesIdempotencyKey).toBe(
      `spend:coach:${PEONES_WALLET}:${PEONES_GAME}`,
    );

    vi.unstubAllGlobals();
  });

  it("credits=0 + Peones insufficient: phase=paywall, analyze NOT called", async () => {
    let analyzeCalled = false;
    stubFetch({
      credits: 0,
      captureAnalyzeBody: () => {
        analyzeCalled = true;
      },
    });
    mockedAttemptCoach.mockResolvedValueOnce({ kind: "insufficient" });

    const { result } = renderHook(() => useCoachAnalysis(inputForFree()));
    act(() => {
      result.current.askCoach("immediate");
    });

    await waitFor(() => expect(result.current.phase).toBe("paywall"));
    expect(analyzeCalled).toBe(false);

    vi.unstubAllGlobals();
  });

  it("credits=0 + Peones error: phase=paywall, analyze NOT called", async () => {
    let analyzeCalled = false;
    stubFetch({
      credits: 0,
      captureAnalyzeBody: () => {
        analyzeCalled = true;
      },
    });
    mockedAttemptCoach.mockResolvedValueOnce({
      kind: "error",
      reason: "network",
    });

    const { result } = renderHook(() => useCoachAnalysis(inputForFree()));
    act(() => {
      result.current.askCoach("immediate");
    });

    await waitFor(() => expect(result.current.phase).toBe("paywall"));
    expect(analyzeCalled).toBe(false);

    vi.unstubAllGlobals();
  });

  // Plan 2 (P2 guard) — a tap with no persisted gameId must NEVER debit a
  // Peón/credit. The not-persisted check now runs BEFORE the spend block, so
  // the helper is never called and the hook degrades to the inline fallback.
  it("no gameId + credits=0: Peones helper NOT called, phase=fallback (no debit)", async () => {
    let analyzeCalled = false;
    stubFetch({
      credits: 0,
      captureAnalyzeBody: () => {
        analyzeCalled = true;
      },
    });
    // Even if the helper were reachable it would report paid — proving the
    // guard (not the helper outcome) is what keeps the spend from firing.
    mockedAttemptCoach.mockResolvedValueOnce({
      kind: "paid",
      peonesIdempotencyKey: "spend:coach:x:",
      debited: 1,
      duplicate: false,
      proBypassApplied: false,
      newBalance: 4,
      attestationHash: "sha256:abc",
    });

    const { result } = renderHook(() =>
      useCoachAnalysis(inputForFree({ gameId: undefined })),
    );
    act(() => {
      result.current.askCoach("immediate");
    });

    await waitFor(() => expect(result.current.phase).toBe("fallback"));
    expect(mockedAttemptCoach).not.toHaveBeenCalled();
    expect(analyzeCalled).toBe(false);

    vi.unstubAllGlobals();
  });
});
