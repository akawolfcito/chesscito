import { describe, it, expect, vi, beforeEach } from "vitest";

const trackMock = vi.fn();
vi.mock("@/lib/telemetry", () => ({
  track: (event: string, props?: Record<string, unknown>) => trackMock(event, props),
}));

import {
  trackAnalyzeRequest,
  trackAnalyzeIdempotentHit,
  trackAnalyzeFailed,
} from "../analyze-telemetry.js";

beforeEach(() => {
  trackMock.mockReset();
});

describe("trackAnalyzeRequest", () => {
  it("emits coach_analyze_request with source + gameId only (history-flow shape)", () => {
    trackAnalyzeRequest({ source: "history", gameId: "abc-uuid" });
    expect(trackMock).toHaveBeenCalledTimes(1);
    expect(trackMock).toHaveBeenCalledWith("coach_analyze_request", {
      source: "history",
      game_id: "abc-uuid",
    });
  });

  it("emits coach_analyze_request with context fields when provided (end-state shape)", () => {
    trackAnalyzeRequest({
      source: "immediate",
      gameId: "end-state-uuid",
      difficulty: "medium",
      moves: 42,
      result: "win",
    });
    expect(trackMock).toHaveBeenCalledWith("coach_analyze_request", {
      source: "immediate",
      game_id: "end-state-uuid",
      difficulty: "medium",
      moves: 42,
      result: "win",
    });
  });

  it("omits optional context fields when undefined (no key bloat)", () => {
    trackAnalyzeRequest({ source: "victory-mint", gameId: "vm-uuid" });
    const props = trackMock.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(props).not.toHaveProperty("difficulty");
    expect(props).not.toHaveProperty("moves");
    expect(props).not.toHaveProperty("result");
  });

  it("supports victory-mint as a valid source", () => {
    trackAnalyzeRequest({
      source: "victory-mint",
      gameId: "vm-uuid",
      difficulty: "hard",
      moves: 50,
      result: "win",
    });
    expect(trackMock).toHaveBeenCalledWith("coach_analyze_request", {
      source: "victory-mint",
      game_id: "vm-uuid",
      difficulty: "hard",
      moves: 50,
      result: "win",
    });
  });
});

describe("trackAnalyzeIdempotentHit", () => {
  it("emits coach_analyze_idempotent_hit with source only", () => {
    trackAnalyzeIdempotentHit("history");
    expect(trackMock).toHaveBeenCalledWith("coach_analyze_idempotent_hit", {
      source: "history",
    });
  });

  it("supports all three source variants", () => {
    trackAnalyzeIdempotentHit("immediate");
    trackAnalyzeIdempotentHit("victory-mint");
    trackAnalyzeIdempotentHit("history");
    expect(trackMock).toHaveBeenCalledTimes(3);
    expect(trackMock.mock.calls.map((c) => c[1])).toEqual([
      { source: "immediate" },
      { source: "victory-mint" },
      { source: "history" },
    ]);
  });
});

describe("trackAnalyzeFailed", () => {
  it("emits coach_analyze_failed with source + reason + status when provided", () => {
    trackAnalyzeFailed({ source: "history", reason: "server_error", status: 500 });
    expect(trackMock).toHaveBeenCalledWith("coach_analyze_failed", {
      source: "history",
      reason: "server_error",
      status: 500,
    });
  });

  it("normalizes missing status to null (consistent schema for analytics)", () => {
    trackAnalyzeFailed({ source: "history", reason: "network_error" });
    expect(trackMock).toHaveBeenCalledWith("coach_analyze_failed", {
      source: "history",
      reason: "network_error",
      status: null,
    });
  });

  it("supports all four failure reasons", () => {
    const reasons = ["network_error", "server_error", "parse_error", "no_payload"] as const;
    for (const reason of reasons) {
      trackAnalyzeFailed({ source: "history", reason });
    }
    expect(trackMock).toHaveBeenCalledTimes(4);
    expect(trackMock.mock.calls.map((c) => (c[1] as { reason: string }).reason)).toEqual([
      "network_error",
      "server_error",
      "parse_error",
      "no_payload",
    ]);
  });
});
