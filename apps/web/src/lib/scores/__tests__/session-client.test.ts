/**
 * Score write session — client cache invalidation (Slice 0.1).
 *
 * The cache is keyed by `(wallet, surface)` on purpose: invalidation is a
 * consequence of the key missing, not a cleanup someone has to remember to
 * call. These tests pin that, because "we forgot to clear it on disconnect" is
 * exactly how a bearer token outlives the identity it belongs to.
 *
 * Audit: docs/product/2026-07-27-score-and-leaders-audit.md §10.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  clearScoreSession,
  ensureScoreSession,
  peekScoreSession,
} from "../session-client";

const WALLET_A = "0x1234567890123456789012345678901234567890";
const WALLET_B = "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd";
const NOW = 1_800_000_000_000;
const NOW_SECONDS = NOW / 1000;

function jsonResponse(status: number, body: unknown) {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as unknown as Response;
}

/** Issues a distinct token per authorization so tests can tell them apart. */
function serverStub(expiresAt = NOW_SECONDS + 7200) {
  let n = 0;
  const fetchImpl = vi.fn(async (url: string) => {
    if (url === "/api/scores/session/challenge") {
      return jsonResponse(200, { message: "Chesscito Score Session v1\n…", expiresAt, maxSaves: 25 });
    }
    if (url === "/api/scores/session/authorize") {
      n += 1;
      return jsonResponse(200, { token: `${n}`.repeat(64).slice(0, 64), expiresAt, maxSaves: 25 });
    }
    throw new Error(`unexpected ${url}`);
  }) as unknown as typeof fetch;
  return fetchImpl;
}

const signer = () => vi.fn(async () => `0x${"ab".repeat(65)}`);

describe("ensureScoreSession", () => {
  beforeEach(() => clearScoreSession());
  afterEach(() => clearScoreSession());

  it("mints once and reuses the cached token", async () => {
    const fetchImpl = serverStub();
    const signMessage = signer();

    const first = await ensureScoreSession({ wallet: WALLET_A, surface: "learn", signMessage, fetchImpl, now: NOW });
    const second = await ensureScoreSession({ wallet: WALLET_A, surface: "learn", signMessage, fetchImpl, now: NOW });

    expect(first.ok && second.ok).toBe(true);
    expect(signMessage).toHaveBeenCalledTimes(1);
    if (first.ok && second.ok) expect(first.session.token).toBe(second.session.token);
  });

  it("re-authorizes when the wallet changes", async () => {
    const fetchImpl = serverStub();
    const signMessage = signer();

    const a = await ensureScoreSession({ wallet: WALLET_A, surface: "learn", signMessage, fetchImpl, now: NOW });
    const b = await ensureScoreSession({ wallet: WALLET_B, surface: "learn", signMessage, fetchImpl, now: NOW });

    expect(signMessage).toHaveBeenCalledTimes(2);
    if (a.ok && b.ok) expect(a.session.token).not.toBe(b.session.token);
  });

  it("never serves wallet A's token to wallet B", async () => {
    const fetchImpl = serverStub();
    const signMessage = signer();

    await ensureScoreSession({ wallet: WALLET_A, surface: "learn", signMessage, fetchImpl, now: NOW });
    const b = await ensureScoreSession({ wallet: WALLET_B, surface: "learn", signMessage, fetchImpl, now: NOW });

    expect(b.ok && b.session.wallet).toBe(WALLET_B.toLowerCase());
  });

  it("re-authorizes when the surface changes", async () => {
    const fetchImpl = serverStub();
    const signMessage = signer();

    await ensureScoreSession({ wallet: WALLET_A, surface: "learn", signMessage, fetchImpl, now: NOW });
    await ensureScoreSession({ wallet: WALLET_A, surface: "play", signMessage, fetchImpl, now: NOW });

    expect(signMessage).toHaveBeenCalledTimes(2);
  });

  it("drops the token on Disconnect", async () => {
    const fetchImpl = serverStub();
    const signMessage = signer();

    await ensureScoreSession({ wallet: WALLET_A, surface: "learn", signMessage, fetchImpl, now: NOW });
    expect(peekScoreSession()).not.toBeNull();

    clearScoreSession();

    expect(peekScoreSession()).toBeNull();
    await ensureScoreSession({ wallet: WALLET_A, surface: "learn", signMessage, fetchImpl, now: NOW });
    expect(signMessage).toHaveBeenCalledTimes(2);
  });

  it("refuses to run without a wallet", async () => {
    const fetchImpl = serverStub();
    const signMessage = signer();
    const r = await ensureScoreSession({ wallet: "", surface: "learn", signMessage, fetchImpl, now: NOW });
    expect(r).toEqual({ ok: false, error: "no_wallet" });
    expect(signMessage).not.toHaveBeenCalled();
  });

  it("re-authorizes once the cached token has expired", async () => {
    const fetchImpl = serverStub(NOW_SECONDS + 100);
    const signMessage = signer();

    await ensureScoreSession({ wallet: WALLET_A, surface: "learn", signMessage, fetchImpl, now: NOW });
    await ensureScoreSession({
      wallet: WALLET_A, surface: "learn", signMessage, fetchImpl,
      now: NOW + 200_000,
    });

    expect(signMessage).toHaveBeenCalledTimes(2);
  });

  it("refreshes BEFORE expiry so a token cannot die in flight", async () => {
    // A token that passes the client check and expires mid-request shows up to
    // the player as a randomly failed save.
    const fetchImpl = serverStub(NOW_SECONDS + 100);
    const signMessage = signer();

    await ensureScoreSession({ wallet: WALLET_A, surface: "learn", signMessage, fetchImpl, now: NOW });
    // 50s in: still valid, but inside the 60s safety margin.
    await ensureScoreSession({
      wallet: WALLET_A, surface: "learn", signMessage, fetchImpl,
      now: NOW + 50_000,
    });

    expect(signMessage).toHaveBeenCalledTimes(2);
  });

  it("forceRefresh mints a new token even when one is cached", async () => {
    const fetchImpl = serverStub();
    const signMessage = signer();

    const a = await ensureScoreSession({ wallet: WALLET_A, surface: "learn", signMessage, fetchImpl, now: NOW });
    const b = await ensureScoreSession({
      wallet: WALLET_A, surface: "learn", signMessage, fetchImpl, now: NOW, forceRefresh: true,
    });

    expect(signMessage).toHaveBeenCalledTimes(2);
    if (a.ok && b.ok) expect(a.session.token).not.toBe(b.session.token);
  });

  it("reports a rejected signature without caching anything", async () => {
    const fetchImpl = serverStub();
    const r = await ensureScoreSession({
      wallet: WALLET_A, surface: "learn", fetchImpl, now: NOW,
      signMessage: vi.fn().mockRejectedValue(new Error("User rejected")),
    });
    expect(r).toEqual({ ok: false, error: "signature_rejected" });
    expect(peekScoreSession()).toBeNull();
  });

  it("caches nothing when authorize fails", async () => {
    const fetchImpl = vi.fn(async (url: string) => {
      if (url === "/api/scores/session/challenge") return jsonResponse(200, { message: "m" });
      return jsonResponse(400, { error: "invalid_challenge" });
    }) as unknown as typeof fetch;

    const r = await ensureScoreSession({ wallet: WALLET_A, surface: "learn", signMessage: signer(), fetchImpl, now: NOW });
    expect(r).toEqual({ ok: false, error: "authorize_failed" });
    expect(peekScoreSession()).toBeNull();
  });
});
