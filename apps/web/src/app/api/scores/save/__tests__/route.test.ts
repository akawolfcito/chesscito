/**
 * POST /api/scores/save — Slice 0 hardened write path.
 *
 * Audit: docs/product/2026-07-27-score-and-leaders-audit.md §R1 (critical).
 *
 * These tests use REAL viem signing (`privateKeyToAccount` + `signMessage`),
 * not a stubbed verifier. The whole finding was that nothing tied a request to
 * a wallet, so a mocked signature check would test the mock and prove nothing.
 * The two well-known keys below are public Hardhat test keys — not secrets.
 *
 * On "MiniPay vs Privy": at the protocol level there is nothing to tell apart.
 * Both produce a standard EOA `personal_sign` signature over the same bytes,
 * which is precisely why EIP-191 was chosen (see save-authorization.ts). The
 * two cases below therefore assert the honest property — that a signature from
 * either wallet's key material is accepted on equal terms — rather than
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

import { POST } from "../route";
import { enforceScoreSaveRateLimit } from "@/lib/server/demo-signing";
import { getSupabaseServer } from "@/lib/supabase/server";
import {
  buildScoreSaveMessage,
  MAX_SCORE_PER_LEVEL,
  type ScoreSaveClaim,
  type ScoreSaveSurface,
} from "@/lib/scores/save-authorization";
import { __setLoggerSink, __resetLoggerSink } from "@/lib/server/logger";

const mockedRate = vi.mocked(enforceScoreSaveRateLimit);
const mockedSupabase = vi.mocked(getSupabaseServer);

/** Public Hardhat test keys. Never funded, never used outside tests. */
const MINIPAY_KEY = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
const PRIVY_KEY = "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d";

const minipayAccount = privateKeyToAccount(MINIPAY_KEY);
const privyAccount = privateKeyToAccount(PRIVY_KEY);

const CHAIN_ID = 42220;
const NOW = 1_800_000_000_000;
const NONCE = "a1b2c3d4e5f60718293a4b5c6d7e8f90";

function claimFor(
  account: { address: string },
  over: Partial<ScoreSaveClaim> = {},
): ScoreSaveClaim {
  const issuedAt = Math.floor(NOW / 1000);
  return {
    chainId: CHAIN_ID,
    player: account.address.toLowerCase(),
    surface: "learn",
    levelId: 1,
    score: 1200,
    timeMs: 5000,
    issuedAt,
    expiresAt: issuedAt + 120,
    nonce: NONCE,
    ...over,
  };
}

/** Sign a claim with `signer`. Passing a claim that names a DIFFERENT address
 *  is how the impersonation cases are built. */
async function signedBody(
  signer: typeof minipayAccount,
  claim: ScoreSaveClaim,
): Promise<{ message: string; signature: string }> {
  const message = buildScoreSaveMessage(claim);
  const signature = await signer.signMessage({ message });
  return { message, signature };
}

function makeRequest(
  body: unknown,
  headers: Record<string, string> = { origin: "http://localhost:3000" },
) {
  return new Request("http://localhost/api/scores/save", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

/** Nonce store that accepts the first burn of a (wallet, nonce) and reports a
 *  Postgres unique violation for every repeat — the real table's behaviour. */
function installNonceStore() {
  const spent = new Set<string>();
  supabaseMock.from.mockImplementation((table: string) => {
    if (table !== "score_save_nonces") throw new Error(`unexpected table ${table}`);
    return {
      insert: (row: { wallet: string; nonce: string }) => {
        const key = `${row.wallet}:${row.nonce}`;
        if (spent.has(key)) {
          return Promise.resolve({ error: { code: "23505", message: "duplicate key" } });
        }
        spent.add(key);
        return Promise.resolve({ error: null });
      },
    };
  });
  return spent;
}

/** Best-score-per-level store mirroring `save_basic_score`: the save_id UNIQUE
 *  makes an identical re-save a `duplicate`, a better score a fresh row. */
function installScoreStore() {
  const rows = new Map<string, { level: number; score: number }>();
  supabaseMock.rpc.mockImplementation(
    (_fn: string, args: Record<string, unknown>) => {
      const saveId = args.p_save_id as string;
      if (rows.has(saveId)) {
        return Promise.resolve({
          data: { status: "duplicate", mode: "free", freeUsed: rows.size },
          error: null,
        });
      }
      rows.set(saveId, {
        level: args.p_level_id as number,
        score: args.p_score as number,
      });
      return Promise.resolve({
        data: { status: "saved", mode: "free", freeUsed: rows.size },
        error: null,
      });
    },
  );
  return rows;
}

describe("POST /api/scores/save — Slice 0 write path", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    __setLoggerSink(() => {});
    process.env.NEXT_PUBLIC_CHAIN_ID = String(CHAIN_ID);
    process.env.NEXT_PUBLIC_CHESSCITO_MODE = "learn";
    mockedRate.mockResolvedValue(undefined);
    mockedSupabase.mockReturnValue(supabaseMock as never);
    installNonceStore();
    installScoreStore();
  });

  afterEach(() => {
    vi.useRealTimers();
    __resetLoggerSink();
    delete process.env.NEXT_PUBLIC_APP_URL;
  });

  // ── 1–3, 13: authorship ──────────────────────────────────────────────────

  it("rejects a request with no signature", async () => {
    const message = buildScoreSaveMessage(claimFor(minipayAccount));
    const res = await POST(makeRequest({ message }));
    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toMatchObject({ reason: "missing_signature" });
    expect(supabaseMock.rpc).not.toHaveBeenCalled();
  });

  it("rejects a garbage signature", async () => {
    const message = buildScoreSaveMessage(claimFor(minipayAccount));
    const res = await POST(makeRequest({ message, signature: `0x${"11".repeat(65)}` }));
    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toMatchObject({ reason: "signature_mismatch" });
    expect(supabaseMock.rpc).not.toHaveBeenCalled();
  });

  it("rejects a signature from a different wallet than the message names", async () => {
    // The impersonation case. Privy's key signs a message that claims MiniPay's
    // address — exactly what R1 allowed, and what must now fail.
    const body = await signedBody(privyAccount, claimFor(minipayAccount));
    const res = await POST(makeRequest(body));
    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toMatchObject({ reason: "signature_mismatch" });
    expect(supabaseMock.rpc).not.toHaveBeenCalled();
  });

  it("never writes for a wallet the caller does not control", async () => {
    const claim = claimFor(minipayAccount, { score: MAX_SCORE_PER_LEVEL });
    await POST(makeRequest(await signedBody(privyAccount, claim)));
    expect(supabaseMock.rpc).not.toHaveBeenCalled();
  });

  it("ignores any player field smuggled in the request body", async () => {
    // Authorship comes from recovery, never from the body.
    const body = await signedBody(minipayAccount, claimFor(minipayAccount));
    await POST(makeRequest({ ...body, player: privyAccount.address }));
    expect(supabaseMock.rpc).toHaveBeenCalledWith(
      "save_basic_score",
      expect.objectContaining({ p_wallet: minipayAccount.address.toLowerCase() }),
    );
  });

  // ── 4–5: freshness and replay ────────────────────────────────────────────

  it("rejects an expired payload", async () => {
    const body = await signedBody(minipayAccount, claimFor(minipayAccount));
    vi.setSystemTime(NOW + 10 * 60 * 1000);
    const res = await POST(makeRequest(body));
    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toMatchObject({ reason: "expired" });
    expect(supabaseMock.rpc).not.toHaveBeenCalled();
  });

  it("rejects a replay of the same nonce", async () => {
    const body = await signedBody(minipayAccount, claimFor(minipayAccount));

    const first = await POST(makeRequest(body));
    expect(first.status).toBe(200);

    const replay = await POST(makeRequest(body));
    expect(replay.status).toBe(401);
    await expect(replay.json()).resolves.toMatchObject({ reason: "nonce_replayed" });
    expect(supabaseMock.rpc).toHaveBeenCalledTimes(1);
  });

  it("burns the nonce BEFORE writing, so a replay cannot reach the RPC", async () => {
    const body = await signedBody(minipayAccount, claimFor(minipayAccount));
    await POST(makeRequest(body));
    supabaseMock.rpc.mockClear();
    await POST(makeRequest(body));
    expect(supabaseMock.rpc).not.toHaveBeenCalled();
  });

  it("fails closed when the nonce store is unreachable", async () => {
    supabaseMock.from.mockImplementation(() => ({
      insert: () => Promise.resolve({ error: { code: "08006", message: "down" } }),
    }));
    const body = await signedBody(minipayAccount, claimFor(minipayAccount));
    const res = await POST(makeRequest(body));
    expect(res.status).toBe(503);
    expect(supabaseMock.rpc).not.toHaveBeenCalled();
  });

  // ── 6–8: bounds ──────────────────────────────────────────────────────────

  it("rejects a score above the per-level ceiling", async () => {
    const claim = claimFor(minipayAccount, { score: MAX_SCORE_PER_LEVEL + 1 });
    const res = await POST(makeRequest(await signedBody(minipayAccount, claim)));
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toMatchObject({ reason: "score_out_of_range" });
    expect(supabaseMock.rpc).not.toHaveBeenCalled();
  });

  it("rejects an out-of-range levelId", async () => {
    const claim = claimFor(minipayAccount, { levelId: 9 });
    const res = await POST(makeRequest(await signedBody(minipayAccount, claim)));
    expect(res.status).toBe(400);
    expect(supabaseMock.rpc).not.toHaveBeenCalled();
  });

  it.each([
    ["NaN", "score: NaN"],
    ["negative", "score: -100"],
    ["Infinity", "score: Infinity"],
    ["fractional", "score: 12.5"],
  ])("rejects a %s score even when correctly signed", async (_label, replacement) => {
    // Signed, so authorship is genuine — the numeric bound is what stops it.
    const message = buildScoreSaveMessage(claimFor(minipayAccount)).replace(
      "score: 1200",
      replacement,
    );
    const signature = await minipayAccount.signMessage({ message });
    const res = await POST(makeRequest({ message, signature }));
    expect(res.status).toBe(400);
    expect(supabaseMock.rpc).not.toHaveBeenCalled();
  });

  // ── 9–10: both wallets ───────────────────────────────────────────────────

  it("saves a valid MiniPay-signed score", async () => {
    const res = await POST(
      makeRequest(await signedBody(minipayAccount, claimFor(minipayAccount))),
    );
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({ status: "saved", mode: "free" });
    expect(supabaseMock.rpc).toHaveBeenCalledWith(
      "save_basic_score",
      expect.objectContaining({
        p_wallet: minipayAccount.address.toLowerCase(),
        p_level_id: 1,
        p_score: 1200,
      }),
    );
  });

  it("saves a valid Privy-signed score on the same terms", async () => {
    const res = await POST(
      makeRequest(await signedBody(privyAccount, claimFor(privyAccount))),
    );
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({ status: "saved" });
    expect(supabaseMock.rpc).toHaveBeenCalledWith(
      "save_basic_score",
      expect.objectContaining({ p_wallet: privyAccount.address.toLowerCase() }),
    );
  });

  // ── 11–12: idempotency and best-of ───────────────────────────────────────

  it("re-saving the same best score is idempotent", async () => {
    const rows = installScoreStore();
    await POST(makeRequest(await signedBody(minipayAccount, claimFor(minipayAccount))));

    // A fresh nonce: this is an honest re-save, not a replay.
    const again = claimFor(minipayAccount, { nonce: "b1b2c3d4e5f60718293a4b5c6d7e8f91" });
    const res = await POST(makeRequest(await signedBody(minipayAccount, again)));

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({ status: "duplicate" });
    expect(rows.size).toBe(1);
  });

  it("a better score writes a new row the aggregate's MAX picks up", async () => {
    const rows = installScoreStore();
    await POST(makeRequest(await signedBody(minipayAccount, claimFor(minipayAccount))));

    const better = claimFor(minipayAccount, {
      score: 1500,
      nonce: "c1b2c3d4e5f60718293a4b5c6d7e8f92",
    });
    const res = await POST(makeRequest(await signedBody(minipayAccount, better)));

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({ status: "saved" });
    expect(rows.size).toBe(2);
    expect([...rows.values()].map((r) => r.score).sort((a, b) => a - b)).toEqual([1200, 1500]);
  });

  // ── 14: the origin bypass ────────────────────────────────────────────────

  it("still validates the signature when Origin and Referer are both absent", async () => {
    // The MiniPay WebView case. It is allowed through — but it buys nothing,
    // because the signature gate runs regardless.
    const forged = await signedBody(privyAccount, claimFor(minipayAccount));
    const res = await POST(makeRequest(forged, {}));
    expect(res.status).toBe(401);
    expect(supabaseMock.rpc).not.toHaveBeenCalled();
  });

  it("accepts a header-less request that IS correctly signed", async () => {
    // Proves the previous test rejected on the signature, not on the headers —
    // MiniPay must keep working.
    const body = await signedBody(minipayAccount, claimFor(minipayAccount));
    const res = await POST(makeRequest(body, {}));
    expect(res.status).toBe(200);
  });

  it("rejects a mismatched origin outright", async () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://learn.chesscito.xyz";
    const body = await signedBody(minipayAccount, claimFor(minipayAccount));
    const res = await POST(makeRequest(body, { origin: "https://evil.example" }));
    expect(res.status).toBe(403);
    expect(supabaseMock.rpc).not.toHaveBeenCalled();
  });

  // ── 15: the aggregate survives a maxed score ─────────────────────────────

  it("accepts a score at the ceiling and keeps six levels inside int range", async () => {
    const claim = claimFor(minipayAccount, { score: MAX_SCORE_PER_LEVEL });
    const res = await POST(makeRequest(await signedBody(minipayAccount, claim)));
    expect(res.status).toBe(200);
    // The value that reaches the DB is what the aggregate has to survive.
    expect(MAX_SCORE_PER_LEVEL * 6).toBeLessThan(2_147_483_647);
  });

  // ── 16–20: surface ───────────────────────────────────────────────────────

  it.each<[ScoreSaveSurface, ScoreSaveSurface, number]>([
    ["learn", "learn", 200],
    ["learn", "play", 400],
    ["play", "play", 200],
    ["play", "learn", 400],
  ])(
    "deployment %s with payload surface %s → %i",
    async (deployment, payload, expected) => {
      process.env.NEXT_PUBLIC_CHESSCITO_MODE = deployment;
      const claim = claimFor(minipayAccount, { surface: payload });
      const res = await POST(makeRequest(await signedBody(minipayAccount, claim)));
      expect(res.status).toBe(expected);
      if (expected === 400) {
        await expect(res.json()).resolves.toMatchObject({ reason: "surface_mismatch" });
        expect(supabaseMock.rpc).not.toHaveBeenCalled();
      }
    },
  );

  it("persists the surface alongside the score", async () => {
    process.env.NEXT_PUBLIC_CHESSCITO_MODE = "play";
    const claim = claimFor(minipayAccount, { surface: "play" });
    await POST(makeRequest(await signedBody(minipayAccount, claim)));
    expect(supabaseMock.rpc).toHaveBeenCalledWith(
      "save_basic_score",
      expect.objectContaining({ p_surface: "play" }),
    );
  });

  // ── Unchanged behaviour that must not regress ────────────────────────────

  it("returns 429 when the soft limiter trips, before any crypto", async () => {
    mockedRate.mockRejectedValue(new Error("Rate limit exceeded"));
    const body = await signedBody(minipayAccount, claimFor(minipayAccount));
    const res = await POST(makeRequest(body));
    expect(res.status).toBe(429);
    expect(supabaseMock.rpc).not.toHaveBeenCalled();
  });

  it("returns 503 rather than a false 'saved' when Supabase is unconfigured", async () => {
    mockedSupabase.mockReturnValue(null as never);
    const body = await signedBody(minipayAccount, claimFor(minipayAccount));
    const res = await POST(makeRequest(body));
    expect(res.status).toBe(503);
    await expect(res.json()).resolves.toMatchObject({ reason: "unavailable" });
  });

  it("never touches the on-chain lane", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    await POST(makeRequest(await signedBody(minipayAccount, claimFor(minipayAccount))));
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});
