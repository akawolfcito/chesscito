/**
 * Tests for POST /api/verify-payment — stablecoin rail slice E.
 * Fail-closed treasury, Transfer verification, idempotent Peones credit.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockGetReceipt = vi.hoisted(() => vi.fn());
const mockIsProActive = vi.hoisted(() => vi.fn());
vi.mock("viem", async (importOriginal) => {
  const actual = await importOriginal<typeof import("viem")>();
  return {
    ...actual,
    createPublicClient: vi.fn(() => ({ getTransactionReceipt: mockGetReceipt })),
  };
});

const mockRedisIncrby = vi.hoisted(() => vi.fn().mockResolvedValue(3));
const mockRedisSet = vi.hoisted(() => vi.fn().mockResolvedValue("OK"));
const mockRedisEval = vi.hoisted(() => vi.fn().mockResolvedValue("1234567890000"));
const mockRedisGet = vi.hoisted(() => vi.fn().mockResolvedValue(null));
vi.mock("@upstash/redis", () => ({
  Redis: {
    fromEnv: vi.fn(() => ({
      incrby: mockRedisIncrby,
      set: mockRedisSet,
      eval: mockRedisEval,
      get: mockRedisGet,
    })),
  },
}));

vi.mock("@/lib/server/demo-signing", () => ({
  enforceOrigin: vi.fn(),
  enforceReadRateLimit: vi.fn(),
  getRequestIp: vi.fn(() => "127.0.0.1"),
}));
vi.mock("@/lib/supabase/server", () => ({ getSupabaseServer: vi.fn() }));
vi.mock("@/lib/server/logger", () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));
vi.mock("@/lib/pro/is-active", () => ({ isProActive: mockIsProActive }));

import { encodeAbiParameters, encodeEventTopics } from "viem";
import { POST } from "../route";
import { erc20Abi } from "@/lib/contracts/tokens";
import { getSupabaseServer } from "@/lib/supabase/server";

const mockedSupabase = vi.mocked(getSupabaseServer);

const USDC = "0xcebA9300f2b948710d2653dD7B07f33A8B32118C";
const TREASURY = "0x1234567890abcdef1234567890abcdef12345678";
const WALLET = "0xaaaabbbbccccddddeeeeffff0000111122223333";
const TX = `0x${"a".repeat(64)}` as const;
const EXPECTED = 500_000n;

function transferLog(token: string, from: string, to: string, value: bigint, logIndex: number) {
  const topics = encodeEventTopics({
    abi: erc20Abi,
    eventName: "Transfer",
    args: { from: from as `0x${string}`, to: to as `0x${string}` },
  });
  const data = encodeAbiParameters([{ type: "uint256" }], [value]);
  return { address: token, topics, data, logIndex };
}

function receiptWith(logs: unknown[], to: string = USDC) {
  // `to` defaults to the payment token (a direct transfer). The route's
  // anti-replay guard requires receipt.to == the declared token.
  return { status: "success", to, logs };
}

function makeRequest(body: Record<string, unknown> | string): Request {
  return new Request("http://localhost/api/verify-payment", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

function baseBody(over: Record<string, unknown> = {}) {
  return { chainId: 42220, txHash: TX, wallet: WALLET, token: USDC, sku: "peones_pack_50", ...over };
}

/** Supabase mock — pre-check select (existingRow) then race re-resolve
 *  (raceRow); insert path; rpc for the optional newBalance. */
function buildSupabaseMock(opts: {
  outcome?: "credited" | "duplicate";
  settlementError?: { code?: string; message?: string } | null;
  capRow?: { balance: number } | null;
} = {}) {
  const rpc = vi.fn().mockImplementation((name: string) => {
    if (name === "consume_legacy_get_peones_payment") {
      return Promise.resolve({
        data: opts.settlementError ? null : [{ outcome: opts.outcome ?? "credited", ledger_id: 1, peones_credited: 50 }],
        error: opts.settlementError ?? null,
      });
    }
    return Promise.resolve({
      data: opts.capRow !== undefined ? [opts.capRow] : [{ balance: 50 }],
      error: null,
    });
  });
  return { supabase: { from: vi.fn(), rpc } as never, rpc };
}

beforeEach(() => {
  process.env.CHESSCITO_TREASURY_ADDRESS = TREASURY;
  mockGetReceipt.mockReset();
  mockGetReceipt.mockResolvedValue(receiptWith([transferLog(USDC, WALLET, TREASURY, EXPECTED, 3)]));
  mockedSupabase.mockReset();
  mockedSupabase.mockReturnValue(buildSupabaseMock().supabase);
  mockIsProActive.mockReset().mockResolvedValue({ active: false, expiresAt: null });
});
afterEach(() => {
  delete process.env.CHESSCITO_TREASURY_ADDRESS;
  vi.restoreAllMocks();
});

describe("fail-closed", () => {
  it("treasury unset → rail_not_configured, no receipt fetch, no ledger", async () => {
    delete process.env.CHESSCITO_TREASURY_ADDRESS;
    const res = await POST(makeRequest(baseBody()));
    expect(res.status).toBe(503);
    expect((await res.json()).error).toBe("rail_not_configured");
    expect(mockGetReceipt).not.toHaveBeenCalled();
    expect(mockedSupabase).not.toHaveBeenCalled();
  });
});

describe("input validation", () => {
  it("malformed body → invalid_input", async () => {
    const res = await POST(makeRequest("not json"));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("invalid_input");
  });

  it("missing txHash → invalid_input", async () => {
    const res = await POST(makeRequest(baseBody({ txHash: undefined })));
    expect((await res.json()).error).toBe("invalid_input");
  });

  it("unsupported chain → unsupported_chain", async () => {
    const res = await POST(makeRequest(baseBody({ chainId: 1 })));
    expect((await res.json()).error).toBe("unsupported_chain");
  });

  it("unknown sku → unknown_sku", async () => {
    const res = await POST(makeRequest(baseBody({ sku: "peones_pack_999" })));
    expect((await res.json()).error).toBe("unknown_sku");
  });

  it("unsupported token → unsupported_token", async () => {
    const res = await POST(makeRequest(baseBody({ token: "0x9999888877776666555544443333222211110000" })));
    expect((await res.json()).error).toBe("unsupported_token");
  });
});

describe("transfer verification", () => {
  it("no matching Transfer → transfer_not_found", async () => {
    mockGetReceipt.mockResolvedValue(
      receiptWith([transferLog(USDC, WALLET, "0x9999888877776666555544443333222211110000", EXPECTED, 0)]),
    );
    const res = await POST(makeRequest(baseBody()));
    expect((await res.json()).error).toBe("transfer_not_found");
  });

  it("amount too low → amount_too_low", async () => {
    mockGetReceipt.mockResolvedValue(receiptWith([transferLog(USDC, WALLET, TREASURY, EXPECTED - 1n, 0)]));
    const res = await POST(makeRequest(baseBody()));
    expect((await res.json()).error).toBe("amount_too_low");
  });

  it("anti-replay: a Shop-style tx (receipt.to != token) → not_direct_transfer", async () => {
    // Same Transfer(buyer→treasury) event, but the tx went to the Shop
    // contract, not the token — must be rejected to stop cross-rail replay.
    const SHOP = "0x5555666677778888999900001111222233334444";
    mockGetReceipt.mockResolvedValue(
      receiptWith([transferLog(USDC, WALLET, TREASURY, EXPECTED, 0)], SHOP),
    );
    const res = await POST(makeRequest(baseBody()));
    expect((await res.json()).error).toBe("not_direct_transfer");
  });
});

describe("crediting", () => {
  it("exact USDC payment → credits 50 Peones", async () => {
    const mock = buildSupabaseMock();
    mockedSupabase.mockReturnValue(mock.supabase);
    const res = await POST(makeRequest(baseBody()));
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.peonesCredited).toBe(50);
    expect(json.duplicate).toBe(false);
    expect(json.overpaid).toBe(false);
    expect(json.logIndex).toBe(3);
    expect(json.idempotencyKey).toBe(`pack_purchase:42220:${TX}:3`);
    expect(mock.rpc).toHaveBeenCalledWith(
      "consume_legacy_get_peones_payment",
      expect.objectContaining({ p_chain_id: 42220, p_log_index: 3 }),
    );
  });

  it("overpay → credits nominal 50, overpaid true", async () => {
    mockGetReceipt.mockResolvedValue(receiptWith([transferLog(USDC, WALLET, TREASURY, EXPECTED + 10n, 1)]));
    const res = await POST(makeRequest(baseBody()));
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.peonesCredited).toBe(50);
    expect(json.overpaid).toBe(true);
  });

  it("duplicate idempotency → success duplicate, no insert", async () => {
    const mock = buildSupabaseMock({ outcome: "duplicate" });
    mockedSupabase.mockReturnValue(mock.supabase);
    const res = await POST(makeRequest(baseBody()));
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.duplicate).toBe(true);
    expect(json.peonesCredited).toBe(50);
    expect(mock.rpc).toHaveBeenCalledTimes(2);
  });

  it("normalizes wallet/token to lowercase in the response", async () => {
    const res = await POST(
      makeRequest(baseBody({ wallet: WALLET.toUpperCase().replace("0X", "0x") })),
    );
    const json = await res.json();
    expect(json.wallet).toBe(WALLET);
    expect(json.token).toBe(USDC.toLowerCase());
  });
});

// ── Season Pass tests ───────────────────────────────────────────────────────

const SP_PRICE = 990_000n; // $0.99 in USD6 → 990_000 USDC-6-decimals units
const SP_SKU = "lite_season_pass_21";
const SEASON_ID = "21day-mind-challenge-2026-q3";

function spBody(over: Record<string, unknown> = {}) {
  return { chainId: 42220, txHash: TX, wallet: WALLET, token: USDC, sku: SP_SKU, ...over };
}

/** Supabase mock for the lite_season_passes table. */
function buildSeasonPassSupabaseMock(opts: {
  existingPass?: Record<string, unknown> | null;
  settlementError?: { code?: string; message?: string } | null;
} = {}) {
  const updateSpy = vi.fn();
  const from = vi.fn(() => ({
    update: updateSpy.mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    }),
  }));
  const existing = opts.existingPass;
  const rpc = vi.fn().mockResolvedValue({
    data: opts.settlementError ? null : [{
      outcome: existing ? "duplicate" : "credited",
      pass_id: existing?.id ?? "00000000-0000-4000-8000-000000000001",
      expires_at: existing?.expires_at ?? "2026-07-16T00:00:00.000Z",
      shields_credited: existing?.shields_credited ?? 3,
      supporter_status: existing?.supporter_status ?? "challenger",
      metadata: existing?.metadata ?? { rail: "stablecoin_single_tx" },
    }],
    error: opts.settlementError ?? null,
  });
  return { supabase: { from, rpc } as never, rpc, updateSpy };
}

describe("season pass", () => {
  beforeEach(() => {
    // Season Pass is Lite-only — the route gate rejects it in Full builds.
    process.env.NEXT_PUBLIC_CHESSCITO_LITE_MODE = "true";
    mockRedisIncrby.mockReset().mockResolvedValue(3);
    mockRedisSet.mockReset().mockResolvedValue("OK");
  });
  afterEach(() => {
    delete process.env.NEXT_PUBLIC_CHESSCITO_LITE_MODE;
  });

  it("Full mode (not Lite) → season_pass_unavailable 404, no receipt, no ledger", async () => {
    delete process.env.NEXT_PUBLIC_CHESSCITO_LITE_MODE;
    const res = await POST(makeRequest(spBody()));
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe("season_pass_unavailable");
    expect(mockGetReceipt).not.toHaveBeenCalled();
    expect(mockedSupabase).not.toHaveBeenCalled();
  });

  it("Lite mode → peones pack still works (gate is Season-Pass-only)", async () => {
    const mock = buildSupabaseMock();
    mockedSupabase.mockReturnValue(mock.supabase);
    const res = await POST(makeRequest(baseBody()));
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.peonesCredited).toBe(50);
  });

  it("valid $0.99 payment → issues season pass, credits 3 shields", async () => {
    mockGetReceipt.mockResolvedValue(receiptWith([transferLog(USDC, WALLET, TREASURY, SP_PRICE, 0)]));
    mockedSupabase.mockReturnValue(buildSeasonPassSupabaseMock().supabase);
    const res = await POST(makeRequest(spBody()));
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.sku).toBe(SP_SKU);
    expect(json.seasonId).toBe(SEASON_ID);
    expect(json.shieldsCredited).toBe(3);
    expect(json.supporterStatus).toBe("challenger");
    expect(json.duplicate).toBe(false);
    expect(json.expiresAt).toBeTruthy();
    expect(mockRedisIncrby).toHaveBeenCalledWith(expect.stringContaining("shields:credited"), 3);
    expect(mockRedisSet).toHaveBeenCalledWith(
      expect.stringContaining("lite:season-pass:"),
      expect.any(String),
      expect.objectContaining({ px: expect.any(Number) }),
    );
  });

  it("active PRO → 409 included_with_pro before receipt or shield credit", async () => {
    mockIsProActive.mockResolvedValue({
      active: true,
      expiresAt: Date.now() + 7 * 86_400_000,
    });

    const res = await POST(makeRequest(spBody()));
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ ok: false, error: "included_with_pro" });
    expect(mockGetReceipt).not.toHaveBeenCalled();
    expect(mockedSupabase).not.toHaveBeenCalled();
    expect(mockRedisIncrby).not.toHaveBeenCalled();
  });

  it("Season Pass entitlement check failure → 503 before receipt", async () => {
    mockIsProActive.mockRejectedValue(new Error("redis unavailable"));

    const res = await POST(makeRequest(spBody()));
    expect(res.status).toBe(503);
    expect((await res.json()).error).toBe("entitlement_unavailable");
    expect(mockGetReceipt).not.toHaveBeenCalled();
  });

  it("duplicate season pass tx → ok, duplicate true, no insert, no redis", async () => {
    mockGetReceipt.mockResolvedValue(receiptWith([transferLog(USDC, WALLET, TREASURY, SP_PRICE, 0)]));
    const existingPass = {
      id: "uuid-1", expires_at: "2026-07-16T00:00:00.000Z",
      season_id: SEASON_ID, supporter_status: "challenger", shields_credited: 3,
    };
    const mock = buildSeasonPassSupabaseMock({ existingPass });
    mockedSupabase.mockReturnValue(mock.supabase);
    const res = await POST(makeRequest(spBody()));
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.duplicate).toBe(true);
    expect(json.shieldsCredited).toBe(3);
    expect(mock.rpc).toHaveBeenCalledTimes(1);
    expect(mockRedisIncrby).not.toHaveBeenCalled();
  });

  it("redis failure after insert → ok, shieldsPending true, shieldsCredited 0", async () => {
    mockGetReceipt.mockResolvedValue(receiptWith([transferLog(USDC, WALLET, TREASURY, SP_PRICE, 0)]));
    mockRedisIncrby.mockRejectedValue(new Error("redis down"));
    mockedSupabase.mockReturnValue(buildSeasonPassSupabaseMock().supabase);
    const res = await POST(makeRequest(spBody()));
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.shieldsCredited).toBe(0);
    expect(json.shieldsPending).toBe(true);
  });

  it("retry of a pending pass → reconciles shields once, credits 3, no duplicate", async () => {
    mockGetReceipt.mockResolvedValue(receiptWith([transferLog(USDC, WALLET, TREASURY, SP_PRICE, 0)]));
    const pendingPass = {
      id: "uuid-1", expires_at: "2026-07-16T00:00:00.000Z",
      season_id: SEASON_ID, supporter_status: "challenger",
      shields_credited: 0, metadata: { rail: "stablecoin_single_tx", shieldsPending: true },
    };
    const mock = buildSeasonPassSupabaseMock({ existingPass: pendingPass });
    mockedSupabase.mockReturnValue(mock.supabase);
    const res = await POST(makeRequest(spBody()));
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.duplicate).toBe(true);
    expect(json.shieldsCredited).toBe(3);
    expect(json.shieldsPending).toBeUndefined();
    expect(mockRedisIncrby).toHaveBeenCalledTimes(1);
    expect(mockRedisIncrby).toHaveBeenCalledWith(expect.stringContaining("shields:credited"), 3);
    expect(mock.rpc).toHaveBeenCalledTimes(1);
    expect(mock.updateSpy).toHaveBeenCalled();
  });

  it("third retry (shields already credited) → no redis, no double-credit", async () => {
    mockGetReceipt.mockResolvedValue(receiptWith([transferLog(USDC, WALLET, TREASURY, SP_PRICE, 0)]));
    const creditedPass = {
      id: "uuid-1", expires_at: "2026-07-16T00:00:00.000Z",
      season_id: SEASON_ID, supporter_status: "challenger",
      shields_credited: 3, metadata: { rail: "stablecoin_single_tx", shieldsPending: false },
    };
    const mock = buildSeasonPassSupabaseMock({ existingPass: creditedPass });
    mockedSupabase.mockReturnValue(mock.supabase);
    const res = await POST(makeRequest(spBody()));
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.duplicate).toBe(true);
    expect(json.shieldsCredited).toBe(3);
    expect(json.shieldsPending).toBeUndefined();
    expect(mockRedisIncrby).not.toHaveBeenCalled();
    expect(mock.updateSpy).not.toHaveBeenCalled();
  });

  it("supabase unavailable for season pass → 503 ledger_unavailable", async () => {
    mockGetReceipt.mockResolvedValue(receiptWith([transferLog(USDC, WALLET, TREASURY, SP_PRICE, 0)]));
    mockedSupabase.mockReturnValue(null as never);
    const res = await POST(makeRequest(spBody()));
    expect(res.status).toBe(503);
    expect((await res.json()).error).toBe("ledger_unavailable");
  });

  it("amount too low for season pass → amount_too_low", async () => {
    mockGetReceipt.mockResolvedValue(receiptWith([transferLog(USDC, WALLET, TREASURY, SP_PRICE - 1n, 0)]));
    const res = await POST(makeRequest(spBody()));
    expect((await res.json()).error).toBe("amount_too_low");
  });
});

// ── Chesscito PRO tests (no-approve rail) ───────────────────────────────────
// Same mechanism as Season Pass, but the grant is the shared Redis
// extend-or-set (lib/coach/pro-extend.ts) — the SAME value the Shop.buyItem
// path already writes to, so both grant paths compose instead of racing.

const PRO_PRICE = 1_990_000n; // $1.99, matches PRO_PRICE_USD6 in shop-catalog.ts
const PRO_SKU = "chesscito_pro_30";

function proBody(over: Record<string, unknown> = {}) {
  return { chainId: 42220, txHash: TX, wallet: WALLET, token: USDC, sku: PRO_SKU, ...over };
}

function buildProSupabaseMock(opts: {
  outcome?: "credited" | "duplicate";
  settlementError?: { code?: string; message?: string } | null;
  expiresAtMs?: number;
} = {}) {
  // Defaults to the same value mockRedisEval resolves to by default, so a
  // "credited" mock realistically echoes back what the route just sent it
  // (RPC records p_expires_at as-is — see 20260701140000_pro_treasury_payment.sql).
  const expiresAtIso = new Date(opts.expiresAtMs ?? 1234567890000).toISOString();
  const rpc = vi.fn().mockResolvedValue({
    data: opts.settlementError ? null : [{
      outcome: opts.outcome ?? "credited",
      subscription_id: "00000000-0000-4000-8000-000000000002",
      expires_at: expiresAtIso,
      metadata: { rail: "stablecoin_single_tx" },
    }],
    error: opts.settlementError ?? null,
  });
  return { supabase: { from: vi.fn(), rpc } as never, rpc };
}

describe("chesscito pro", () => {
  beforeEach(() => {
    mockRedisEval.mockReset().mockResolvedValue("1234567890000");
    mockRedisGet.mockReset().mockResolvedValue(null); // not yet processed by default
  });

  it("valid $1.99 payment → credits PRO via the shared Redis extend, not duplicate", async () => {
    mockGetReceipt.mockResolvedValue(receiptWith([transferLog(USDC, WALLET, TREASURY, PRO_PRICE, 0)]));
    const mock = buildProSupabaseMock();
    mockedSupabase.mockReturnValue(mock.supabase);
    const res = await POST(makeRequest(proBody()));
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.sku).toBe(PRO_SKU);
    expect(json.duplicate).toBe(false);
    expect(json.expiresAt).toBe(1234567890000);
    // Redis extend runs BEFORE the RPC call so the RPC records the
    // already-extended value, same ordering as the shop verify-pro route.
    expect(mockRedisEval).toHaveBeenCalledWith(
      expect.stringContaining("redis.call('GET', KEYS[1])"),
      [expect.stringContaining("coach:pro:")],
      expect.arrayContaining([expect.any(Number)]),
    );
    expect(mock.rpc).toHaveBeenCalledWith(
      "consume_pro_treasury_payment",
      expect.objectContaining({ p_sku: PRO_SKU, p_expires_at: expect.any(String) }),
    );
    // The Season Pass entitlement gate is deliberately one-way: buying PRO
    // never checks or consumes an existing direct Season Pass.
    expect(mockIsProActive).not.toHaveBeenCalled();
  });

  it("duplicate PRO tx → ok, duplicate true, no second Redis extend", async () => {
    mockGetReceipt.mockResolvedValue(receiptWith([transferLog(USDC, WALLET, TREASURY, PRO_PRICE, 0)]));
    mockRedisGet.mockResolvedValue("1"); // this tx hash was already processed once
    const mock = buildProSupabaseMock({ outcome: "duplicate" });
    mockedSupabase.mockReturnValue(mock.supabase);
    const res = await POST(makeRequest(proBody()));
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.duplicate).toBe(true);
    // A duplicate must never re-extend the Redis expiry — that would let a
    // retried/replayed verify call grant extra PRO time for one payment.
    expect(mockRedisEval).not.toHaveBeenCalled();
  });

  it("amount too low for PRO → amount_too_low, no Redis call, no RPC", async () => {
    mockGetReceipt.mockResolvedValue(receiptWith([transferLog(USDC, WALLET, TREASURY, PRO_PRICE - 1n, 0)]));
    const res = await POST(makeRequest(proBody()));
    expect((await res.json()).error).toBe("amount_too_low");
    expect(mockRedisEval).not.toHaveBeenCalled();
  });

  it("supabase unavailable for PRO → 503 ledger_unavailable", async () => {
    mockGetReceipt.mockResolvedValue(receiptWith([transferLog(USDC, WALLET, TREASURY, PRO_PRICE, 0)]));
    mockedSupabase.mockReturnValue(null as never);
    const res = await POST(makeRequest(proBody()));
    expect(res.status).toBe(503);
    expect((await res.json()).error).toBe("ledger_unavailable");
  });

  it("settlement error (not replay) → 500 ledger_write_failed", async () => {
    mockGetReceipt.mockResolvedValue(receiptWith([transferLog(USDC, WALLET, TREASURY, PRO_PRICE, 0)]));
    const mock = buildProSupabaseMock({ settlementError: { message: "boom" } });
    mockedSupabase.mockReturnValue(mock.supabase);
    const res = await POST(makeRequest(proBody()));
    expect(res.status).toBe(500);
    expect((await res.json()).error).toBe("ledger_write_failed");
  });

  it("settlement error containing payment_replay → 409 payment_replay", async () => {
    mockGetReceipt.mockResolvedValue(receiptWith([transferLog(USDC, WALLET, TREASURY, PRO_PRICE, 0)]));
    const mock = buildProSupabaseMock({ settlementError: { message: "payment_replay" } });
    mockedSupabase.mockReturnValue(mock.supabase);
    const res = await POST(makeRequest(proBody()));
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe("payment_replay");
  });
});

describe("ledger errors", () => {
  it("supabase unavailable → ledger_unavailable", async () => {
    mockedSupabase.mockReturnValue(null as never);
    const res = await POST(makeRequest(baseBody()));
    expect(res.status).toBe(503);
    expect((await res.json()).error).toBe("ledger_unavailable");
  });

  it("insert error, row absent on re-check → ledger_write_failed", async () => {
    mockedSupabase.mockReturnValue(
      buildSupabaseMock({ settlementError: { code: "XXXXX", message: "boom" } }).supabase,
    );
    const res = await POST(makeRequest(baseBody()));
    expect(res.status).toBe(500);
    expect((await res.json()).error).toBe("ledger_write_failed");
  });

  it("transient insert error but row landed → success duplicate, not 500", async () => {
    // The on-chain transfer already settled; a non-23505 insert error (timeout,
    // 503) whose write actually committed must NOT surface as a failed payment.
    // The idempotency re-check finds the row → idempotent success.
    const mock = buildSupabaseMock({ outcome: "duplicate" });
    mockedSupabase.mockReturnValue(mock.supabase);
    const res = await POST(makeRequest(baseBody()));
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.duplicate).toBe(true);
    expect(json.peonesCredited).toBe(50);
  });
});

describe("global ERC-20 payment identity", () => {
  it("rejects Get Peones when the payment was consumed by Season Pass", async () => {
    mockedSupabase.mockReturnValue(buildSupabaseMock({
      settlementError: { code: "P0001", message: "payment_replay" },
    }).supabase);
    const res = await POST(makeRequest(baseBody()));
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe("payment_replay");
  });

  it("rejects Season Pass when the payment was consumed by Get Peones", async () => {
    process.env.NEXT_PUBLIC_CHESSCITO_LITE_MODE = "true";
    mockGetReceipt.mockResolvedValue(receiptWith([
      transferLog(USDC, WALLET, TREASURY, SP_PRICE, 0),
    ]));
    mockedSupabase.mockReturnValue(buildSeasonPassSupabaseMock({
      settlementError: { code: "P0001", message: "payment_replay" },
    }).supabase);
    const res = await POST(makeRequest(spBody()));
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe("payment_replay");
    delete process.env.NEXT_PUBLIC_CHESSCITO_LITE_MODE;
  });

  it("concurrent same-product verification resolves as one credit and one duplicate", async () => {
    let consumeCalls = 0;
    const rpc = vi.fn().mockImplementation((name: string) => {
      if (name === "consume_legacy_get_peones_payment") {
        consumeCalls += 1;
        return Promise.resolve({
          data: [{ outcome: consumeCalls === 1 ? "credited" : "duplicate", ledger_id: 1 }],
          error: null,
        });
      }
      return Promise.resolve({ data: [{ balance: 50 }], error: null });
    });
    mockedSupabase.mockReturnValue({ from: vi.fn(), rpc } as never);

    const [first, second] = await Promise.all([
      POST(makeRequest(baseBody())),
      POST(makeRequest(baseBody())),
    ]);
    const results = await Promise.all([first.json(), second.json()]);
    expect(results.map((result) => result.duplicate).sort()).toEqual([false, true]);
    expect(consumeCalls).toBe(2);
  });
});
