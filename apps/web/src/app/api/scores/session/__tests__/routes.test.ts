/**
 * Score write session endpoints — challenge + authorize (Slice 0.1).
 *
 * Audit: docs/product/2026-07-27-score-and-leaders-audit.md §10.
 *
 * Uses REAL viem signing, not a stubbed verifier: the property under test is
 * that a signature ties a session to a wallet, and a mocked check would test
 * the mock. The keys are public Hardhat test keys — not secrets.
 *
 * On "MiniPay vs Privy": at the protocol level there is nothing to tell apart.
 * Both produce a standard EOA `personal_sign` signature over the same bytes,
 * which is exactly why EIP-191 was chosen. The tests assert the honest
 * property — either wallet's key material works on equal terms — rather than
 * pretending the endpoint can detect a provider.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { privateKeyToAccount } from "viem/accounts";

const redisMock = vi.hoisted(() => ({ get: vi.fn(), set: vi.fn(), eval: vi.fn() }));
vi.mock("@upstash/redis", () => ({ Redis: { fromEnv: () => redisMock } }));

vi.mock("@/lib/server/demo-signing", () => ({
  enforceScoreSaveRateLimit: vi.fn(),
  getRequestIp: vi.fn(() => "127.0.0.1"),
}));

const supabaseMock = vi.hoisted(() => ({ rpc: vi.fn(), from: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({
  getSupabaseServer: vi.fn(() => supabaseMock),
}));

import { POST as challengePOST } from "../challenge/route";
import { POST as authorizePOST } from "../authorize/route";
import { enforceScoreSaveRateLimit } from "@/lib/server/demo-signing";
import { getSupabaseServer } from "@/lib/supabase/server";
import {
  parseScoreSessionMessage,
  SCORE_SESSION_MAX_SAVES,
  SCORE_SESSION_TTL_SECONDS,
} from "@/lib/scores/session-authorization";
import { hashSessionToken } from "@/lib/server/score-session-store";
import { __setLoggerSink, __resetLoggerSink } from "@/lib/server/logger";

const mockedRate = vi.mocked(enforceScoreSaveRateLimit);
const mockedSupabase = vi.mocked(getSupabaseServer);

/** Public Hardhat test keys. Never funded, never used outside tests. */
const minipay = privateKeyToAccount(
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
);
const privy = privateKeyToAccount(
  "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d",
);

const CHAIN_ID = 42220;
const NOW = 1_800_000_000_000;

type Row = {
  session_id: string;
  wallet: string;
  surface: string;
  token_hash: string | null;
  expires_at: string;
  challenge_expires_at: string;
  max_saves: number;
  used_saves: number;
  revoked_at: string | null;
};

/** In-memory stand-in for `score_write_sessions` + its two RPCs. Mirrors the
 *  SQL predicates exactly — including that authorize matches on the STORED
 *  wallet/surface, which is what stops a fabricated message from minting a
 *  session. */
function installStore() {
  const rows = new Map<string, Row>();

  supabaseMock.from.mockImplementation((table: string) => {
    if (table !== "score_write_sessions") throw new Error(`unexpected table ${table}`);
    return {
      insert: (row: Row) => {
        rows.set(row.session_id, { ...row });
        return Promise.resolve({ error: null });
      },
    };
  });

  supabaseMock.rpc.mockImplementation((fn: string, args: Record<string, unknown>) => {
    if (fn !== "authorize_score_write_session") {
      throw new Error(`unexpected rpc ${fn}`);
    }
    const row = rows.get(args.p_session_id as string);
    if (!row) return Promise.resolve({ data: { status: "not_found" }, error: null });
    if (row.revoked_at) return Promise.resolve({ data: { status: "revoked" }, error: null });
    if (row.token_hash) {
      return Promise.resolve({ data: { status: "already_used" }, error: null });
    }
    if (Date.parse(row.challenge_expires_at) <= Date.now()) {
      return Promise.resolve({ data: { status: "challenge_expired" }, error: null });
    }
    if (row.wallet !== args.p_wallet || row.surface !== args.p_surface) {
      return Promise.resolve({ data: { status: "mismatch" }, error: null });
    }
    row.token_hash = args.p_token_hash as string;
    return Promise.resolve({
      data: {
        status: "authorized",
        sessionId: row.session_id,
        expiresAt: row.expires_at,
        maxSaves: row.max_saves,
      },
      error: null,
    });
  });

  return rows;
}

function req(url: string, body: unknown, headers: Record<string, string> = {}) {
  return new Request(url, {
    method: "POST",
    headers: { "content-type": "application/json", origin: "http://localhost:3000", ...headers },
    body: JSON.stringify(body),
  });
}

const challengeReq = (body: unknown, h?: Record<string, string>) =>
  req("http://localhost/api/scores/session/challenge", body, h);
const authorizeReq = (body: unknown, h?: Record<string, string>) =>
  req("http://localhost/api/scores/session/authorize", body, h);

/** Full happy path: challenge → sign → authorize. */
async function mintSession(account: typeof minipay) {
  const cRes = await challengePOST(challengeReq({ wallet: account.address }));
  const { message } = (await cRes.json()) as { message: string };
  const signature = await account.signMessage({ message });
  const aRes = await authorizePOST(authorizeReq({ message, signature }));
  return { message, signature, response: aRes };
}

describe("score write session endpoints", () => {
  let rows: Map<string, Row>;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    __setLoggerSink(() => {});
    process.env.NEXT_PUBLIC_CHAIN_ID = String(CHAIN_ID);
    process.env.NEXT_PUBLIC_CHESSCITO_MODE = "learn";
    mockedRate.mockResolvedValue(undefined);
    mockedSupabase.mockReturnValue(supabaseMock as never);
    rows = installStore();
  });

  afterEach(() => {
    vi.useRealTimers();
    __resetLoggerSink();
    delete process.env.NEXT_PUBLIC_APP_URL;
  });

  // ── 1: the server owns the terms ─────────────────────────────────────────

  it("issues a challenge whose every term is server-decided", async () => {
    const res = await challengePOST(challengeReq({ wallet: minipay.address }));
    expect(res.status).toBe(200);

    const body = (await res.json()) as { message: string; sessionId: string };
    const parsed = parseScoreSessionMessage(body.message)!;

    expect(parsed.sessionId).toMatch(/^[0-9a-f]{32}$/);
    expect(parsed.maxSaves).toBe(SCORE_SESSION_MAX_SAVES);
    expect(parsed.expiresAt - parsed.issuedAt).toBe(SCORE_SESSION_TTL_SECONDS);
    expect(parsed.wallet).toBe(minipay.address.toLowerCase());
    expect(parsed.chainId).toBe(CHAIN_ID);
  });

  it("ignores a surface proposed by the client and stamps the deployment's", async () => {
    // A Learn build must not be able to mint a play capability, however
    // politely asked (audit R12).
    const res = await challengePOST(
      challengeReq({ wallet: minipay.address, surface: "play" }),
    );
    const { message } = (await res.json()) as { message: string };
    expect(parseScoreSessionMessage(message)!.surface).toBe("learn");
  });

  it("issues a distinct sessionId per challenge", async () => {
    await challengePOST(challengeReq({ wallet: minipay.address }));
    await challengePOST(challengeReq({ wallet: minipay.address }));
    expect(rows.size).toBe(2);
  });

  it("rejects a malformed wallet", async () => {
    const res = await challengePOST(challengeReq({ wallet: "0xnope" }));
    expect(res.status).toBe(400);
  });

  // ── 4, 5, 21: signature ──────────────────────────────────────────────────

  it("does not create a session from an invalid signature", async () => {
    const cRes = await challengePOST(challengeReq({ wallet: minipay.address }));
    const { message } = (await cRes.json()) as { message: string };
    const res = await authorizePOST(
      authorizeReq({ message, signature: `0x${"11".repeat(65)}` }),
    );
    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toMatchObject({ error: "signature_mismatch" });
    expect([...rows.values()][0]!.token_hash).toBeNull();
  });

  it("does not create a session when another wallet signs", async () => {
    // Privy's key signs a challenge issued for MiniPay's address.
    const cRes = await challengePOST(challengeReq({ wallet: minipay.address }));
    const { message } = (await cRes.json()) as { message: string };
    const signature = await privy.signMessage({ message });
    const res = await authorizePOST(authorizeReq({ message, signature }));
    expect(res.status).toBe(401);
    expect([...rows.values()][0]!.token_hash).toBeNull();
  });

  it("does not create a session from terms the server never issued", async () => {
    // A fabricated message, correctly signed, with a sessionId nobody wrote.
    const { buildScoreSessionMessage } = await import(
      "@/lib/scores/session-authorization"
    );
    const issued = Math.floor(NOW / 1000);
    const message = buildScoreSessionMessage({
      chainId: CHAIN_ID,
      wallet: minipay.address.toLowerCase(),
      surface: "learn",
      sessionId: "ffffffffffffffffffffffffffffffff",
      issuedAt: issued,
      expiresAt: issued + SCORE_SESSION_TTL_SECONDS,
      maxSaves: SCORE_SESSION_MAX_SAVES,
    });
    const signature = await minipay.signMessage({ message });
    const res = await authorizePOST(authorizeReq({ message, signature }));
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toMatchObject({ error: "invalid_challenge" });
  });

  it.each([
    ["MiniPay", () => minipay],
    ["Privy", () => privy],
  ])("mints a session for a valid %s signature", async (_label, account) => {
    const { response } = await mintSession(account());
    expect(response.status).toBe(200);
    const body = (await response.json()) as { token: string; maxSaves: number };
    expect(body.token).toMatch(/^[0-9a-f]{64}$/);
    expect(body.maxSaves).toBe(SCORE_SESSION_MAX_SAVES);
  });

  // ── 3: single use ────────────────────────────────────────────────────────

  it("consumes a challenge exactly once", async () => {
    const cRes = await challengePOST(challengeReq({ wallet: minipay.address }));
    const { message } = (await cRes.json()) as { message: string };
    const signature = await minipay.signMessage({ message });

    const first = await authorizePOST(authorizeReq({ message, signature }));
    expect(first.status).toBe(200);

    const replay = await authorizePOST(authorizeReq({ message, signature }));
    expect(replay.status).toBe(409);
    await expect(replay.json()).resolves.toMatchObject({ error: "already_used" });
  });

  it("issues a different token for each authorization", async () => {
    const a = await mintSession(minipay);
    const b = await mintSession(minipay);
    const tokenA = ((await a.response.json()) as { token: string }).token;
    const tokenB = ((await b.response.json()) as { token: string }).token;
    expect(tokenA).not.toBe(tokenB);
  });

  // ── 2: challenge freshness ───────────────────────────────────────────────

  it("rejects a challenge signed after it went stale", async () => {
    const cRes = await challengePOST(challengeReq({ wallet: minipay.address }));
    const { message } = (await cRes.json()) as { message: string };
    const signature = await minipay.signMessage({ message });

    vi.setSystemTime(NOW + 10 * 60 * 1000); // past challenge_expires_at, inside session TTL

    const res = await authorizePOST(authorizeReq({ message, signature }));
    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toMatchObject({ error: "challenge_expired" });
  });

  it("rejects a signed challenge past the SESSION window outright", async () => {
    const cRes = await challengePOST(challengeReq({ wallet: minipay.address }));
    const { message } = (await cRes.json()) as { message: string };
    const signature = await minipay.signMessage({ message });

    vi.setSystemTime(NOW + (SCORE_SESSION_TTL_SECONDS + 600) * 1000);

    const res = await authorizePOST(authorizeReq({ message, signature }));
    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toMatchObject({ error: "expired" });
  });

  // ── 6: surface vs deployment ─────────────────────────────────────────────

  it("rejects a challenge for the other product", async () => {
    // Issue on a play build, then authorize against a learn build.
    process.env.NEXT_PUBLIC_CHESSCITO_MODE = "play";
    const cRes = await challengePOST(challengeReq({ wallet: minipay.address }));
    const { message } = (await cRes.json()) as { message: string };
    const signature = await minipay.signMessage({ message });

    process.env.NEXT_PUBLIC_CHESSCITO_MODE = "learn";
    const res = await authorizePOST(authorizeReq({ message, signature }));
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toMatchObject({ error: "surface_mismatch" });
  });

  // ── 8: only the hash is stored ───────────────────────────────────────────

  it("stores only the hash of the token, never the token", async () => {
    const { response } = await mintSession(minipay);
    const { token } = (await response.json()) as { token: string };

    const stored = [...rows.values()][0]!;
    expect(stored.token_hash).toBe(hashSessionToken(token));
    expect(stored.token_hash).not.toBe(token);
    expect(JSON.stringify(stored)).not.toContain(token);
  });

  // ── infrastructure ───────────────────────────────────────────────────────

  it("returns 429 when the limiter trips, before any crypto", async () => {
    mockedRate.mockRejectedValue(new Error("Rate limit exceeded"));
    const res = await challengePOST(challengeReq({ wallet: minipay.address }));
    expect(res.status).toBe(429);
    expect(supabaseMock.from).not.toHaveBeenCalled();
  });

  it("returns 503 rather than a fake challenge when Supabase is unconfigured", async () => {
    mockedSupabase.mockReturnValue(null as never);
    const res = await challengePOST(challengeReq({ wallet: minipay.address }));
    expect(res.status).toBe(503);
  });

  it("rejects a mismatched origin on authorize", async () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://learn.chesscito.xyz";
    const res = await authorizePOST(
      authorizeReq({ message: "x", signature: "y" }, { origin: "https://evil.example" }),
    );
    expect(res.status).toBe(403);
  });

  it("still verifies the signature when Origin and Referer are absent", async () => {
    // MiniPay's WebView case: allowed through, but it buys nothing.
    const cRes = await challengePOST(challengeReq({ wallet: minipay.address }));
    const { message } = (await cRes.json()) as { message: string };
    const forged = await privy.signMessage({ message });

    const bare = new Request("http://localhost/api/scores/session/authorize", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ message, signature: forged }),
    });
    const res = await authorizePOST(bare);
    expect(res.status).toBe(401);
  });
});
