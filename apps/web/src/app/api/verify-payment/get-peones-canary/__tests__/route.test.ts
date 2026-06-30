import { beforeEach, describe, expect, it, vi } from "vitest";

const getTransaction = vi.hoisted(() => vi.fn());
const getTransactionReceipt = vi.hoisted(() => vi.fn());
const getBlockNumber = vi.hoisted(() => vi.fn());
const getBlock = vi.hoisted(() => vi.fn());
vi.mock("viem", async (importOriginal) => {
  const actual = await importOriginal<typeof import("viem")>();
  return {
    ...actual,
    createPublicClient: () => ({ getTransaction, getTransactionReceipt, getBlockNumber, getBlock }),
  };
});

vi.mock("@/lib/server/demo-signing", () => ({
  enforceOrigin: vi.fn(),
  enforceReadRateLimit: vi.fn(),
  getRequestIp: () => "127.0.0.1",
}));
vi.mock("@/lib/server/logger", () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
  hashWallet: () => "wallet-hash",
}));

const getSupabaseServer = vi.hoisted(() => vi.fn());
vi.mock("@/lib/supabase/server", () => ({ getSupabaseServer }));

import { encodeAbiParameters, encodeEventTopics, encodeFunctionData, erc20Abi } from "viem";
import { POST } from "../route";

const INTENT_ID = "123e4567-e89b-42d3-a456-426614174000";
const TX_HASH = `0x${"a".repeat(64)}` as const;
const WALLET = "0xaaaabbbbccccddddeeeeffff0000111122223333" as const;
const TOKEN = "0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e" as const;
const TREASURY = "0x1234567890abcdef1234567890abcdef12345678" as const;
const EXPECTED = 500_000n;

const intentRow = {
  id: INTENT_ID,
  wallet: WALLET,
  sku: "peones_pack_50",
  token_address: TOKEN,
  token_symbol: "USDT",
  token_decimals: 6,
  expected_amount: EXPECTED.toString(),
  chain_id: 42220,
  treasury_address: TREASURY,
  config_version: "canary-v1",
  price_version: "peones-50-v1",
  required_confirmations: 2,
  auth_binding: "client_asserted_wallet",
  expires_at: "2099-01-01T00:00:00.000Z",
};

function transferLog(logIndex = 3) {
  return {
    address: TOKEN,
    topics: encodeEventTopics({ abi: erc20Abi, eventName: "Transfer", args: { from: WALLET, to: TREASURY } }),
    data: encodeAbiParameters([{ type: "uint256" }], [EXPECTED]),
    logIndex,
  };
}

function request(extra: Record<string, unknown> = {}) {
  return new Request("http://localhost/api/verify-payment/get-peones-canary", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ intentId: INTENT_ID, txHash: TX_HASH, ...extra }),
  });
}

function supabaseMock(args: {
  row?: typeof intentRow;
  rpcResult?: Array<{ outcome: string; ledger_id: number }>;
  rpcError?: { message: string; code?: string } | null;
} = {}) {
  const rpc = vi.fn().mockResolvedValue({
    data: args.rpcResult ?? [{ outcome: "credited", ledger_id: 7 }],
    error: args.rpcError ?? null,
  });
  const from = vi.fn(() => ({
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        maybeSingle: vi.fn().mockResolvedValue({ data: args.row ?? intentRow, error: null }),
      })),
    })),
  }));
  return { client: { from, rpc }, rpc };
}

beforeEach(() => {
  vi.clearAllMocks();
  getTransaction.mockResolvedValue({
    to: TOKEN,
    from: WALLET,
    input: encodeFunctionData({ abi: erc20Abi, functionName: "transfer", args: [TREASURY, EXPECTED] }),
  });
  getTransactionReceipt.mockResolvedValue({
    status: "success",
    blockNumber: 100n,
    logs: [transferLog()],
  });
  getBlockNumber.mockResolvedValue(101n);
  getBlock.mockResolvedValue({ timestamp: 1_800_000_000n });
  getSupabaseServer.mockReturnValue(supabaseMock().client);
});

describe("Get Peones canary settlement route", () => {
  it("credits exactly 50 Peones through the atomic RPC", async () => {
    const mock = supabaseMock();
    getSupabaseServer.mockReturnValue(mock.client);
    const response = await POST(request());
    const json = await response.json();
    expect(response.status).toBe(200);
    expect(json.peonesCredited).toBe(50);
    expect(json.duplicate).toBe(false);
    expect(mock.rpc).toHaveBeenCalledTimes(1);
    expect(mock.rpc.mock.calls[0][1]).toMatchObject({
      p_chain_id: 42220,
      p_tx_hash: TX_HASH,
      p_log_index: 3,
      p_amount_paid: EXPECTED.toString(),
    });
  });

  it("keeps mined-payment recovery available when new intent creation is disabled", async () => {
    delete process.env.GET_PEONES_TREASURY_CANARY_ENABLED;
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect((await response.json()).peonesCredited).toBe(50);
  });

  it("returns idempotent success when concurrent verification already credited", async () => {
    const mock = supabaseMock();
    mock.rpc
      .mockResolvedValueOnce({ data: [{ outcome: "credited", ledger_id: 7 }], error: null })
      .mockResolvedValueOnce({ data: [{ outcome: "duplicate", ledger_id: 7 }], error: null });
    getSupabaseServer.mockReturnValue(mock.client);
    const [first, second] = await Promise.all([POST(request()), POST(request())]);
    expect((await first.json()).duplicate).toBe(false);
    expect((await second.json()).duplicate).toBe(true);
    expect(mock.rpc).toHaveBeenCalledTimes(2);
  });

  it("rejects a globally consumed payment", async () => {
    const mock = supabaseMock({ rpcError: { message: "payment_replay", code: "P0001" } });
    getSupabaseServer.mockReturnValue(mock.client);
    const response = await POST(request());
    expect(response.status).toBe(409);
    expect((await response.json()).error).toBe("replay_rejected");
  });

  it("keeps entitlement failure recoverable", async () => {
    const mock = supabaseMock({ rpcError: { message: "database unavailable", code: "08006" } });
    getSupabaseServer.mockReturnValue(mock.client);
    const response = await POST(request());
    expect(response.status).toBe(503);
    expect((await response.json()).error).toBe("entitlement_failed_recoverable");
  });

  it("rejects an expired intent", async () => {
    const mock = supabaseMock({ row: { ...intentRow, expires_at: "2020-01-01T00:00:00.000Z" } });
    getSupabaseServer.mockReturnValue(mock.client);
    const response = await POST(request());
    expect((await response.json()).error).toBe("expired_intent");
    expect(mock.rpc).not.toHaveBeenCalled();
  });

  it("rejects ambiguous matching events", async () => {
    getTransactionReceipt.mockResolvedValue({
      status: "success",
      blockNumber: 100n,
      logs: [transferLog(3), transferLog(4)],
    });
    const response = await POST(request());
    expect((await response.json()).error).toBe("ambiguous_event");
  });

  it("waits for the configured finality threshold", async () => {
    getBlockNumber.mockResolvedValue(100n);
    const response = await POST(request());
    expect(response.status).toBe(409);
    expect((await response.json()).error).toBe("finality_pending");
  });
});
