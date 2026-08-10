/**
 * Tests for the Peones spend caller-authorization guard (P0, 2026-08-10).
 *
 * The property under test is the one the vulnerability violated: the debited
 * wallet is resolved from a proven session row, never trusted from the caller.
 */

import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

import {
  isSpendSessionRequired,
  readSpendBearerToken,
  resolveSpendSessionWallet,
} from "@/lib/scores/spend-session-guard";
import { hashSessionToken } from "@/lib/server/score-session-store";

const TOKEN = "a".repeat(64);
const WALLET = "0xabcdef0123456789abcdef0123456789abcdef01";
const NOW = Date.UTC(2026, 7, 10, 12, 0, 0); // 2026-08-10T12:00:00Z

function req(headers: Record<string, string>): Request {
  return new Request("http://localhost/api/peones/spend", {
    method: "POST",
    headers,
  });
}

/** Minimal Supabase stub for the single-row session read. */
function supabaseReturning(
  row: Record<string, unknown> | null,
  error: unknown = null,
) {
  const maybeSingle = vi.fn(async () => ({ data: row, error }));
  const eq = vi.fn(() => ({ maybeSingle }));
  const select = vi.fn(() => ({ eq }));
  const from = vi.fn(() => ({ select }));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { from } as any;
}

describe("readSpendBearerToken", () => {
  it("returns the token from a well-formed Bearer header", () => {
    expect(readSpendBearerToken(req({ authorization: `Bearer ${TOKEN}` }))).toBe(
      TOKEN,
    );
  });
  it("returns null when the header is absent", () => {
    expect(readSpendBearerToken(req({}))).toBeNull();
  });
  it("returns null for a malformed token (wrong length / non-hex)", () => {
    expect(readSpendBearerToken(req({ authorization: "Bearer nope" }))).toBeNull();
    expect(
      readSpendBearerToken(req({ authorization: `Bearer ${"a".repeat(63)}` })),
    ).toBeNull();
  });
});

describe("isSpendSessionRequired", () => {
  const prev = process.env.PEONES_SPEND_REQUIRE_SESSION;
  afterEach(() => {
    if (prev === undefined) delete process.env.PEONES_SPEND_REQUIRE_SESSION;
    else process.env.PEONES_SPEND_REQUIRE_SESSION = prev;
  });
  it("defaults to OFF when unset", () => {
    delete process.env.PEONES_SPEND_REQUIRE_SESSION;
    expect(isSpendSessionRequired()).toBe(false);
  });
  it("is on only for the exact string 'true'", () => {
    process.env.PEONES_SPEND_REQUIRE_SESSION = "true";
    expect(isSpendSessionRequired()).toBe(true);
    process.env.PEONES_SPEND_REQUIRE_SESSION = "1";
    expect(isSpendSessionRequired()).toBe(false);
    process.env.PEONES_SPEND_REQUIRE_SESSION = "TRUE";
    expect(isSpendSessionRequired()).toBe(false);
  });
});

describe("resolveSpendSessionWallet", () => {
  const authorized = {
    wallet: WALLET,
    surface: "learn",
    authorized_at: "2026-08-10T11:00:00.000Z",
    revoked_at: null,
    expires_at: "2026-08-10T13:00:00.000Z", // 1h in the future of NOW
  };

  it("resolves the wallet FROM THE SESSION ROW for a valid token", async () => {
    const supabase = supabaseReturning(authorized);
    const res = await resolveSpendSessionWallet(supabase, TOKEN, NOW);
    expect(res).toEqual({ status: "ok", wallet: WALLET, surface: "learn" });
  });

  it("looks the row up by the HASH of the token, never the raw token", async () => {
    const supabase = supabaseReturning(authorized);
    await resolveSpendSessionWallet(supabase, TOKEN, NOW);
    const eq = supabase.from().select().eq;
    expect(eq).toHaveBeenCalledWith("token_hash", hashSessionToken(TOKEN));
    // and that is not the raw token
    expect(hashSessionToken(TOKEN)).not.toBe(TOKEN);
  });

  it("lowercases the resolved wallet", async () => {
    const supabase = supabaseReturning({
      ...authorized,
      wallet: WALLET.toUpperCase().replace("0X", "0x"),
    });
    const res = await resolveSpendSessionWallet(supabase, TOKEN, NOW);
    expect(res).toMatchObject({ status: "ok", wallet: WALLET });
  });

  it("invalid:no_token when the token is missing or malformed", async () => {
    const supabase = supabaseReturning(authorized);
    expect(await resolveSpendSessionWallet(supabase, null, NOW)).toEqual({
      status: "invalid",
      reason: "no_token",
    });
    expect(await resolveSpendSessionWallet(supabase, "short", NOW)).toEqual({
      status: "invalid",
      reason: "no_token",
    });
  });

  it("invalid:not_found when no session row matches", async () => {
    const supabase = supabaseReturning(null);
    expect(await resolveSpendSessionWallet(supabase, TOKEN, NOW)).toEqual({
      status: "invalid",
      reason: "not_found",
    });
  });

  it("invalid:revoked when the session was revoked", async () => {
    const supabase = supabaseReturning({
      ...authorized,
      revoked_at: "2026-08-10T11:30:00.000Z",
    });
    expect(await resolveSpendSessionWallet(supabase, TOKEN, NOW)).toEqual({
      status: "invalid",
      reason: "revoked",
    });
  });

  it("invalid:expired when past expiry beyond the skew tolerance", async () => {
    const supabase = supabaseReturning({
      ...authorized,
      expires_at: "2026-08-10T11:00:00.000Z", // 1h in the past
    });
    expect(await resolveSpendSessionWallet(supabase, TOKEN, NOW)).toEqual({
      status: "invalid",
      reason: "expired",
    });
  });

  it("still valid within the clock-skew tolerance just past expiry", async () => {
    const supabase = supabaseReturning({
      ...authorized,
      // expired 30s ago — inside the 90s skew allowance
      expires_at: new Date(NOW - 30_000).toISOString(),
    });
    const res = await resolveSpendSessionWallet(supabase, TOKEN, NOW);
    expect(res.status).toBe("ok");
  });

  it("invalid:unsigned when the row was never authorized", async () => {
    const supabase = supabaseReturning({ ...authorized, authorized_at: null });
    expect(await resolveSpendSessionWallet(supabase, TOKEN, NOW)).toEqual({
      status: "invalid",
      reason: "unsigned",
    });
  });

  it("unavailable (fail-closed) when the store read errors", async () => {
    const supabase = supabaseReturning(null, { code: "08006" });
    expect(await resolveSpendSessionWallet(supabase, TOKEN, NOW)).toEqual({
      status: "unavailable",
    });
  });
});
