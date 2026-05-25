import { describe, it, expect, vi } from "vitest";
import { requestCoachAnalyze } from "../request-coach-analyze";

const GAME_ID = "11111111-2222-3333-4444-555555555555";
const WALLET = "0xcc4179a22b473ea2eb2b9b9b210458d0f60fc2dd";

function jsonResponse(body: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(body), {
    status: init?.status ?? 200,
    headers: { "content-type": "application/json" },
  });
}

describe("requestCoachAnalyze (Cluster E defer — Edge hunter #16)", () => {
  it("returns kind=ready with idempotent=false on a fresh analyze success", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse({
        status: "ready",
        response: { summary: "good game" },
        proActive: true,
        historyMeta: { gamesPlayed: 12 },
      }),
    );

    const result = await requestCoachAnalyze(GAME_ID, WALLET, fetchImpl);

    expect(result).toEqual({
      kind: "ready",
      response: { summary: "good game" },
      proActive: true,
      historyMeta: { gamesPlayed: 12 },
      idempotent: false,
    });
    expect(fetchImpl).toHaveBeenCalledWith(
      "/api/coach/analyze",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ gameId: GAME_ID, walletAddress: WALLET }),
      }),
    );
  });

  it("returns kind=ready with idempotent=true when server marks the analysis as cached", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse({ status: "ready", response: { summary: "cached" }, idempotent: true }),
    );

    const result = await requestCoachAnalyze(GAME_ID, WALLET, fetchImpl);
    expect(result.kind).toBe("ready");
    if (result.kind === "ready") {
      expect(result.idempotent).toBe(true);
      expect(result.proActive).toBe(false);
    }
  });

  it("returns kind=queued when the server responds with a jobId only", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ jobId: "job-123" }));

    const result = await requestCoachAnalyze(GAME_ID, WALLET, fetchImpl);

    expect(result).toEqual({ kind: "queued", jobId: "job-123", idempotent: false });
  });

  it("returns kind=paywall on HTTP 402", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse({ error: "No credits available" }, { status: 402 }),
    );

    const result = await requestCoachAnalyze(GAME_ID, WALLET, fetchImpl);

    expect(result).toEqual({ kind: "paywall" });
  });

  it("returns kind=error reason=network_error when fetch rejects", async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));

    const result = await requestCoachAnalyze(GAME_ID, WALLET, fetchImpl);

    expect(result).toEqual({ kind: "error", reason: "network_error" });
  });

  it("returns kind=error reason=server_error with status on 5xx responses", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse({ error: "Internal server error" }, { status: 500 }),
    );

    const result = await requestCoachAnalyze(GAME_ID, WALLET, fetchImpl);

    expect(result).toEqual({ kind: "error", reason: "server_error", status: 500 });
  });

  it("returns kind=error reason=parse_error when 200 OK body is not valid JSON", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response("not-json", { status: 200, headers: { "content-type": "text/plain" } }),
    );

    const result = await requestCoachAnalyze(GAME_ID, WALLET, fetchImpl);

    expect(result.kind).toBe("error");
    if (result.kind === "error") {
      expect(result.reason).toBe("parse_error");
      expect(result.status).toBe(200);
    }
  });

  it("returns kind=error reason=no_payload when 200 OK has neither status=ready nor jobId", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({}));

    const result = await requestCoachAnalyze(GAME_ID, WALLET, fetchImpl);

    expect(result).toEqual({ kind: "error", reason: "no_payload", status: 200 });
  });

  // ──────────────────────────────────────────────────────────────────
  // Per-locale cache migration (2026-05-24)
  // ──────────────────────────────────────────────────────────────────

  it("forwards forceLocale=true in the request body when set (Reanalyze flow)", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse({ status: "ready", response: { summary: "fresh" }, locale: "es" }),
    );

    await requestCoachAnalyze(GAME_ID, WALLET, fetchImpl, "es", {
      forceLocale: true,
    });

    expect(fetchImpl).toHaveBeenCalledWith(
      "/api/coach/analyze",
      expect.objectContaining({
        body: JSON.stringify({
          gameId: GAME_ID,
          walletAddress: WALLET,
          locale: "es",
          forceLocale: true,
        }),
      }),
    );
  });

  it("omits forceLocale from the body when option is false / absent (idempotent default)", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse({ status: "ready", response: { summary: "cached" } }),
    );

    await requestCoachAnalyze(GAME_ID, WALLET, fetchImpl, "en");

    expect(fetchImpl).toHaveBeenCalledWith(
      "/api/coach/analyze",
      expect.objectContaining({
        body: JSON.stringify({ gameId: GAME_ID, walletAddress: WALLET, locale: "en" }),
      }),
    );
  });

  it("echoes the server's locale field on a ready outcome", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse({ status: "ready", response: { summary: "es-resp" }, locale: "es" }),
    );

    const result = await requestCoachAnalyze(GAME_ID, WALLET, fetchImpl, "es");

    expect(result.kind).toBe("ready");
    if (result.kind === "ready") {
      expect(result.locale).toBe("es");
    }
  });
});
