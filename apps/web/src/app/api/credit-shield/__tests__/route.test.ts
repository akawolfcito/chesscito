import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { keccak256, toBytes } from "viem";

// Capture env BEFORE module-level imports run.
const { SHOP_ADDRESS } = vi.hoisted(() => {
  const addr = "0x1234567890123456789012345678901234567890";
  process.env.NEXT_PUBLIC_SHOP_ADDRESS = addr;
  process.env.NEXT_PUBLIC_CHAIN_ID = "42220";
  return { SHOP_ADDRESS: addr };
});

// Upstash Redis mock.
const redisMock = vi.hoisted(() => ({
  get: vi.fn(),
  set: vi.fn(),
  eval: vi.fn(),
}));
vi.mock("@upstash/redis", () => ({
  Redis: { fromEnv: () => redisMock },
}));

// viem public client mock — `waitForTransactionReceipt` is the v2
// path (replaces `getTransactionReceipt` from verify-pro). Server
// polls instead of demanding a pre-confirmed tx.
const clientMock = vi.hoisted(() => ({
  waitForTransactionReceipt: vi.fn(),
}));
vi.mock("viem", async () => {
  const actual = await vi.importActual<typeof import("viem")>("viem");
  return {
    ...actual,
    createPublicClient: () => clientMock,
    http: () => ({}),
  };
});

vi.mock("@/lib/server/demo-signing", () => ({
  enforceOrigin: vi.fn(),
  enforceRateLimit: vi.fn(),
  getRequestIp: vi.fn(() => "127.0.0.1"),
}));

import { POST } from "../route";
import { enforceOrigin, enforceRateLimit } from "@/lib/server/demo-signing";
import { __setLoggerSink, __resetLoggerSink } from "@/lib/server/logger";

const mockedOrigin = vi.mocked(enforceOrigin);
const mockedRate = vi.mocked(enforceRateLimit);

let logLines: Array<{ level: string; record: Record<string, unknown> }>;

const VALID_WALLET = "0xcc4179a22b473ea2eb2b9b9b210458d0f60fc2dd";
const VALID_TX = "0x" + "a".repeat(64);
const VALID_TX_2 = "0x" + "b".repeat(64);

const ITEM_PURCHASED_TOPIC = keccak256(
  toBytes(
    "ItemPurchased(address,uint256,uint256,uint256,uint256,address,address)",
  ),
);

const USDC_ADDRESS = "0xcebA9300f2b948710d2653dD7B07f33A8B32118C";
const CELO_ADDRESS = "0x471EcE3750Da237f93B8E339c536989b8978a438";
const TREASURY_ADDRESS = "0x917497FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF";

const SHIELD_ITEM_ID = 2n;
const FOUNDER_BADGE_ITEM_ID = 1n;

function encodeAddressTopic(addr: string) {
  return ("0x" +
    "0".repeat(24) +
    addr.toLowerCase().replace(/^0x/, "")) as `0x${string}`;
}
function encodeUint256Topic(value: bigint) {
  return ("0x" + value.toString(16).padStart(64, "0")) as `0x${string}`;
}
function encodeItemPurchasedData() {
  const enc = (n: bigint) => n.toString(16).padStart(64, "0");
  const encAddr = (a: string) =>
    "0".repeat(24) + a.toLowerCase().replace(/^0x/, "");
  return ("0x" +
    enc(1n) +
    enc(25_000n) +
    enc(25_000_000_000_000_000n) +
    encAddr(TREASURY_ADDRESS)) as `0x${string}`;
}

function makeShieldLog(
  opts: { wallet?: string; itemId?: bigint; token?: string } = {},
) {
  return {
    address: SHOP_ADDRESS,
    topics: [
      ITEM_PURCHASED_TOPIC,
      encodeAddressTopic(opts.wallet ?? VALID_WALLET),
      encodeUint256Topic(opts.itemId ?? SHIELD_ITEM_ID),
      encodeAddressTopic(opts.token ?? USDC_ADDRESS),
    ],
    data: encodeItemPurchasedData(),
  };
}

function makeRequest(body: unknown) {
  return new Request("http://localhost/api/credit-shield", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/credit-shield", () => {
  beforeEach(() => {
    mockedOrigin.mockReset();
    mockedRate.mockReset();
    redisMock.get.mockReset();
    redisMock.set.mockReset();
    redisMock.eval.mockReset();
    clientMock.waitForTransactionReceipt.mockReset();

    mockedOrigin.mockImplementation(() => {});
    mockedRate.mockResolvedValue(undefined);

    logLines = [];
    __setLoggerSink((line, level) => {
      logLines.push({ level, record: JSON.parse(line) });
    });
  });

  afterEach(() => {
    __resetLoggerSink();
  });

  // ─── C1: happy path (AC1) ────────────────────────────────────────

  it("AC1: credits +3 on a fresh single-shield tx", async () => {
    clientMock.waitForTransactionReceipt.mockResolvedValue({
      status: "success",
      logs: [makeShieldLog()],
    });
    redisMock.eval.mockResolvedValue([3, 3]);

    const res = await POST(
      makeRequest({ txHash: VALID_TX, walletAddress: VALID_WALLET }),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      ok: true,
      credited: 3,
      delta: 3,
      txHash: VALID_TX,
    });

    // Lua call shape: KEYS=[processedTx, creditedCounter], ARGV=[delta, ttlSec]
    expect(redisMock.eval).toHaveBeenCalledWith(
      expect.stringContaining("'NX'"),
      [
        `coach:shields:processed-tx:${VALID_TX}`,
        `coach:shields:credited:${VALID_WALLET}`,
      ],
      [3, 90 * 24 * 60 * 60],
    );
  });

  // ─── C2: idempotency (AC2) ──────────────────────────────────────

  it("AC2: idempotent retry returns delta=0 with same credited", async () => {
    clientMock.waitForTransactionReceipt.mockResolvedValue({
      status: "success",
      logs: [makeShieldLog()],
    });
    // Lua's "already-processed" branch returns existing total + delta=0
    redisMock.eval.mockResolvedValue([3, 0]);

    const res = await POST(
      makeRequest({ txHash: VALID_TX, walletAddress: VALID_WALLET }),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      ok: true,
      credited: 3,
      delta: 0,
      txHash: VALID_TX,
    });
  });

  // ─── C3: multi-match + no server cap (AC3) ──────────────────────

  it("AC3: multi-match tx credits matches × SHIELDS_PER_PURCHASE in one Lua call", async () => {
    clientMock.waitForTransactionReceipt.mockResolvedValue({
      status: "success",
      logs: [makeShieldLog(), makeShieldLog()],
    });
    redisMock.eval.mockResolvedValue([6, 6]);

    const res = await POST(
      makeRequest({ txHash: VALID_TX, walletAddress: VALID_WALLET }),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      ok: true,
      credited: 6,
      delta: 6,
      txHash: VALID_TX,
    });

    // delta passed to Lua = 2 matches × 3 = 6; no server-side cap.
    expect(redisMock.eval).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(Array),
      [6, 90 * 24 * 60 * 60],
    );
  });

  it("AC3: server has no cap — second tx adds another +3 even past 30", async () => {
    clientMock.waitForTransactionReceipt.mockResolvedValue({
      status: "success",
      logs: [makeShieldLog()],
    });
    redisMock.eval.mockResolvedValue([33, 3]); // already had 30, +3 → 33

    const res = await POST(
      makeRequest({ txHash: VALID_TX_2, walletAddress: VALID_WALLET }),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      ok: true,
      credited: 33,
      delta: 3,
      txHash: VALID_TX_2,
    });
  });

  // ─── C4: error cases (AC4–AC8 → all collapsed `unprocessable`) ──

  it("AC4: tx with only Founder Badge purchase → unprocessable", async () => {
    clientMock.waitForTransactionReceipt.mockResolvedValue({
      status: "success",
      logs: [makeShieldLog({ itemId: FOUNDER_BADGE_ITEM_ID })],
    });
    const res = await POST(
      makeRequest({ txHash: VALID_TX, walletAddress: VALID_WALLET }),
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ ok: false, error: "unprocessable" });
    expect(redisMock.eval).not.toHaveBeenCalled();
  });

  it("AC5: tx where buyer != requesting wallet → unprocessable", async () => {
    const other = "0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef";
    clientMock.waitForTransactionReceipt.mockResolvedValue({
      status: "success",
      logs: [makeShieldLog({ wallet: other })],
    });
    const res = await POST(
      makeRequest({ txHash: VALID_TX, walletAddress: VALID_WALLET }),
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ ok: false, error: "unprocessable" });
    expect(redisMock.eval).not.toHaveBeenCalled();
  });

  it("AC6: shield tx paid in non-stablecoin (CELO) → unprocessable", async () => {
    clientMock.waitForTransactionReceipt.mockResolvedValue({
      status: "success",
      logs: [makeShieldLog({ token: CELO_ADDRESS })],
    });
    const res = await POST(
      makeRequest({ txHash: VALID_TX, walletAddress: VALID_WALLET }),
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ ok: false, error: "unprocessable" });
    expect(redisMock.eval).not.toHaveBeenCalled();
  });

  it("AC7: receipt status != success → unprocessable", async () => {
    clientMock.waitForTransactionReceipt.mockResolvedValue({
      status: "reverted",
      logs: [],
    });
    const res = await POST(
      makeRequest({ txHash: VALID_TX, walletAddress: VALID_WALLET }),
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ ok: false, error: "unprocessable" });
  });

  it("AC8: receipt fetch times out (poll exhausted) → unprocessable", async () => {
    clientMock.waitForTransactionReceipt.mockRejectedValue(
      new Error("timeout"),
    );
    const res = await POST(
      makeRequest({ txHash: VALID_TX, walletAddress: VALID_WALLET }),
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ ok: false, error: "unprocessable" });
    expect(redisMock.eval).not.toHaveBeenCalled();
  });

  it("ignores logs from a different contract address", async () => {
    clientMock.waitForTransactionReceipt.mockResolvedValue({
      status: "success",
      logs: [
        {
          ...makeShieldLog(),
          address: "0x0000000000000000000000000000000000000099",
        },
      ],
    });
    const res = await POST(
      makeRequest({ txHash: VALID_TX, walletAddress: VALID_WALLET }),
    );
    expect(res.status).toBe(400);
    expect(redisMock.eval).not.toHaveBeenCalled();
  });

  // ─── C5: validation + origin/rate-limit (AC9) ───────────────────

  it("AC9: missing txHash → 400 missing_params", async () => {
    const res = await POST(makeRequest({ walletAddress: VALID_WALLET }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      ok: false,
      error: "missing_params",
    });
  });

  it("AC9: malformed txHash → 400 invalid_tx_hash", async () => {
    const res = await POST(
      makeRequest({ txHash: "0xnope", walletAddress: VALID_WALLET }),
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      ok: false,
      error: "invalid_tx_hash",
    });
  });

  it("AC9: malformed wallet → 400 invalid_wallet", async () => {
    const res = await POST(
      makeRequest({ txHash: VALID_TX, walletAddress: "0xnope" }),
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      ok: false,
      error: "invalid_wallet",
    });
  });

  it("AC9: enforceOrigin throws → 403 origin_blocked", async () => {
    mockedOrigin.mockImplementation(() => {
      throw new Error("Forbidden");
    });
    const res = await POST(
      makeRequest({ txHash: VALID_TX, walletAddress: VALID_WALLET }),
    );
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({
      ok: false,
      error: "origin_blocked",
    });
  });

  it("AC9: enforceRateLimit throws → 429 rate_limited", async () => {
    mockedRate.mockRejectedValue(new Error("Rate limit exceeded"));
    const res = await POST(
      makeRequest({ txHash: VALID_TX, walletAddress: VALID_WALLET }),
    );
    expect(res.status).toBe(429);
    expect(await res.json()).toEqual({
      ok: false,
      error: "rate_limited",
    });
  });

  it("Redis eval blows up → 500 internal (entry stays queued client-side)", async () => {
    clientMock.waitForTransactionReceipt.mockResolvedValue({
      status: "success",
      logs: [makeShieldLog()],
    });
    redisMock.eval.mockRejectedValue(new Error("redis down"));
    const res = await POST(
      makeRequest({ txHash: VALID_TX, walletAddress: VALID_WALLET }),
    );
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ ok: false, error: "internal" });

    const errLine = logLines.find((l) => l.level === "error");
    expect(errLine).toBeDefined();
    expect(errLine?.record.msg).toBe("unhandled exception");
  });

  // ─── observability (mirrors verify-pro pattern) ─────────────────

  it("logs a warn line per failed log decode (regression guard, 2026-05-02 ABI bug)", async () => {
    clientMock.waitForTransactionReceipt.mockResolvedValue({
      status: "success",
      logs: [
        {
          address: SHOP_ADDRESS,
          // Wrong topic count forces decodeEventLog to throw.
          topics: [ITEM_PURCHASED_TOPIC, encodeAddressTopic(VALID_WALLET)],
          data: encodeItemPurchasedData(),
        },
      ],
    });

    const res = await POST(
      makeRequest({ txHash: VALID_TX, walletAddress: VALID_WALLET }),
    );
    expect(res.status).toBe(400);

    const decodeWarn = logLines.find(
      (l) => l.level === "warn" && l.record.msg === "decode failed",
    );
    expect(decodeWarn).toBeDefined();
    expect(decodeWarn?.record.route).toBe("/api/credit-shield");
  });

  it("emits wallet_hash on success log line for forensics", async () => {
    clientMock.waitForTransactionReceipt.mockResolvedValue({
      status: "success",
      logs: [makeShieldLog()],
    });
    redisMock.eval.mockResolvedValue([3, 3]);

    await POST(makeRequest({ txHash: VALID_TX, walletAddress: VALID_WALLET }));

    const okLine = logLines.find(
      (l) => l.level === "info" && l.record.msg === "credit ok",
    );
    expect(okLine).toBeDefined();
    expect(typeof okLine?.record.wallet_hash).toBe("string");
    expect(okLine?.record.delta).toBe(3);
    expect(okLine?.record.credited).toBe(3);
  });
});
