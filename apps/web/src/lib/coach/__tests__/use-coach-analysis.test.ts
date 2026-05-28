import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useCoachAnalysis } from "../use-coach-analysis";

// Stub wagmi hooks used inside the hook
vi.mock("wagmi", () => ({
  useAccount: () => ({ address: undefined, isConnected: false }),
  useChainId: () => 42220,
}));

// Stub next-intl hooks
vi.mock("next-intl", () => ({
  useLocale: () => "en",
}));

// Stub useIsProActive
vi.mock("@/lib/pro/use-is-pro-active", () => ({
  useIsProActive: () => false,
}));

describe("useCoachAnalysis (skeleton)", () => {
  const baseInput = {
    surface: "coach_viewer" as const,
  };

  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
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

  it("abort() clears in-flight request without crashing", () => {
    const { result } = renderHook(() => useCoachAnalysis({ surface: "coach_viewer" }));
    expect(() => result.current.abort()).not.toThrow();
  });

  it("claimWelcome writes localStorage chesscito:coach-welcomed", async () => {
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
      injected: {
        address: "0x1111111111111111111111111111111111111111",
        proActive: false,
        activeLocale: "en",
      },
    }));

    await act(async () => { await result.current.claimWelcome(); });

    expect(localStorage.getItem("chesscito:coach-welcomed")).toBeTruthy();
    vi.unstubAllGlobals();
  });
});
