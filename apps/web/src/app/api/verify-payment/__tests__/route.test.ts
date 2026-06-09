/**
 * Tests for POST /api/verify-payment — stablecoin rail slice E.
 * Fail-closed treasury, Transfer verification, idempotent Peones credit.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockGetReceipt = vi.hoisted(() => vi.fn());
vi.mock("viem", async (importOriginal) => {
  const actual = await importOriginal<typeof import("viem")>();
  return {
    ...actual,
    createPublicClient: vi.fn(() => ({ getTransactionReceipt: mockGetReceipt })),
  };
});

vi.mock("@/lib/server/demo-signing", () => ({
  enforceOrigin: vi.fn(),
  enforceReadRateLimit: vi.fn(),
  getRequestIp: vi.fn(() => "127.0.0.1"),
}));
vi.mock("@/lib/supabase/server", () => ({ getSupabaseServer: vi.fn() }));
vi.mock("@/lib/server/logger", () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));

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
  existingRow?: { id: number; amount: number; attestation_hash?: string } | null;
  existingRowError?: { code?: string; message?: string };
  insertResult?: { data: { id: number } | null; error: { code?: string; message?: string } | null };
  raceRow?: { id: number; amount: number } | null;
  capRow?: { balance: number } | null;
} = {}) {
  const insertSpy = vi.fn();
  let selectIdx = 0;
  const rpc = vi.fn().mockResolvedValue({
    data: opts.capRow !== undefined ? [opts.capRow] : [{ balance: 50 }],
    error: null,
  });
  const from = vi.fn(() => ({
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        maybeSingle: vi.fn().mockImplementation(() => {
          const idx = selectIdx++;
          if (idx === 0) {
            return Promise.resolve({ data: opts.existingRow ?? null, error: opts.existingRowError ?? null });
          }
          return Promise.resolve({ data: opts.raceRow ?? null, error: null });
        }),
      })),
    })),
    insert: insertSpy.mockReturnValue({
      select: vi.fn(() => ({
        maybeSingle: vi.fn().mockResolvedValue(opts.insertResult ?? { data: { id: 1 }, error: null }),
      })),
    }),
  }));
  return { supabase: { from, rpc } as never, from, rpc, insertSpy };
}

beforeEach(() => {
  process.env.CHESSCITO_TREASURY_ADDRESS = TREASURY;
  mockGetReceipt.mockReset();
  mockGetReceipt.mockResolvedValue(receiptWith([transferLog(USDC, WALLET, TREASURY, EXPECTED, 3)]));
  mockedSupabase.mockReset();
  mockedSupabase.mockReturnValue(buildSupabaseMock().supabase);
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
    const mock = buildSupabaseMock({ insertResult: { data: { id: 7 }, error: null } });
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
    expect(mock.insertSpy).toHaveBeenCalledTimes(1);
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
    const mock = buildSupabaseMock({ existingRow: { id: 99, amount: 50 } });
    mockedSupabase.mockReturnValue(mock.supabase);
    const res = await POST(makeRequest(baseBody()));
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.duplicate).toBe(true);
    expect(json.peonesCredited).toBe(50);
    expect(mock.insertSpy).not.toHaveBeenCalled();
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

describe("ledger errors", () => {
  it("supabase unavailable → ledger_unavailable", async () => {
    mockedSupabase.mockReturnValue(null as never);
    const res = await POST(makeRequest(baseBody()));
    expect(res.status).toBe(503);
    expect((await res.json()).error).toBe("ledger_unavailable");
  });

  it("insert error → ledger_write_failed", async () => {
    mockedSupabase.mockReturnValue(
      buildSupabaseMock({ insertResult: { data: null, error: { code: "XXXXX", message: "boom" } } }).supabase,
    );
    const res = await POST(makeRequest(baseBody()));
    expect(res.status).toBe(500);
    expect((await res.json()).error).toBe("ledger_write_failed");
  });
});
