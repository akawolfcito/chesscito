import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const getBytecode = vi.hoisted(() => vi.fn());
const readContract = vi.hoisted(() => vi.fn());
vi.mock("viem", async (importOriginal) => {
  const actual = await importOriginal<typeof import("viem")>();
  return {
    ...actual,
    createPublicClient: () => ({ getBytecode, readContract }),
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

import { PATCH, POST } from "../route";

const WALLET = "0xaaaabbbbccccddddeeeeffff0000111122223333";
const USDT = "0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e";
const TREASURY = "0x1234567890abcdef1234567890abcdef12345678";

const ENV_KEYS = [
  "GET_PEONES_TREASURY_CANARY_ENABLED",
  "CHESSCITO_TREASURY_CANARY_ADDRESS",
  "CHESSCITO_TREASURY_CANARY_CONFIG_VERSION",
  "CHESSCITO_TREASURY_CANARY_PRICE_VERSION",
  "CHESSCITO_TREASURY_CANARY_CONFIRMATIONS",
  "CHESSCITO_TREASURY_CANARY_TOKEN_ADDRESSES",
  "ALLOW_CLIENT_ASSERTED_WALLET_FOR_GET_PEONES_CANARY",
] as const;

function request(token = USDT) {
  return new Request("http://localhost/api/payment-intents/get-peones", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ wallet: WALLET, token, sku: "peones_pack_50", chainId: 42220 }),
  });
}

function configure() {
  process.env.GET_PEONES_TREASURY_CANARY_ENABLED = "true";
  process.env.CHESSCITO_TREASURY_CANARY_ADDRESS = TREASURY;
  process.env.CHESSCITO_TREASURY_CANARY_CONFIG_VERSION = "canary-v1";
  process.env.CHESSCITO_TREASURY_CANARY_PRICE_VERSION = "peones-50-v1";
  process.env.CHESSCITO_TREASURY_CANARY_CONFIRMATIONS = "2";
  process.env.CHESSCITO_TREASURY_CANARY_TOKEN_ADDRESSES = USDT;
  process.env.ALLOW_CLIENT_ASSERTED_WALLET_FOR_GET_PEONES_CANARY = "true";
}

beforeEach(() => {
  for (const key of ENV_KEYS) delete process.env[key];
  getBytecode.mockResolvedValue("0x6000");
  readContract.mockResolvedValueOnce(true).mockResolvedValueOnce(6);
  getSupabaseServer.mockReturnValue({
    from: () => ({ insert: vi.fn().mockResolvedValue({ error: null }) }),
  });
});
afterEach(() => {
  for (const key of ENV_KEYS) delete process.env[key];
});

describe("Get Peones canary intent endpoint", () => {
  it("is server-authoritatively disabled by default", async () => {
    const response = await POST(request());
    expect(response.status).toBe(404);
    expect((await response.json()).error).toBe("canary_disabled");
    expect(getBytecode).not.toHaveBeenCalled();
  });

  it("fails closed when the explicit Treasury is missing", async () => {
    process.env.GET_PEONES_TREASURY_CANARY_ENABLED = "true";
    const response = await POST(request());
    expect(response.status).toBe(503);
    expect((await response.json()).error).toBe("canary_treasury_missing");
  });

  it("fails closed when client-asserted wallet risk is not explicitly accepted", async () => {
    configure();
    delete process.env.ALLOW_CLIENT_ASSERTED_WALLET_FOR_GET_PEONES_CANARY;
    const response = await POST(request());
    expect(response.status).toBe(503);
    expect((await response.json()).error).toBe("canary_client_asserted_wallet_not_allowed");
    expect(getBytecode).not.toHaveBeenCalled();
  });

  it("rejects a token outside the canary allowlist", async () => {
    configure();
    const response = await POST(request("0xcebA9300f2b948710d2653dD7B07f33A8B32118C"));
    expect(response.status).toBe(400);
    expect((await response.json()).error).toBe("wrong_token");
  });

  it("unknown-submission logging rejects an intent that does not exist", async () => {
    getSupabaseServer.mockReturnValue({
      from: () => ({
        select: () => ({
          eq: () => ({ maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }) }),
        }),
      }),
    });
    const response = await PATCH(new Request("http://localhost/api/payment-intents/get-peones", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        intentId: "00000000-0000-4000-8000-000000000001",
        event: "unknown_submission_state",
      }),
    }));
    expect(response.status).toBe(404);
    expect((await response.json()).error).toBe("intent_not_found");
  });

  it("creates immutable server-decided terms before broadcast", async () => {
    configure();
    const response = await POST(request());
    const json = await response.json();
    expect(response.status).toBe(200);
    expect(json.intent).toMatchObject({
      wallet: WALLET,
      sku: "peones_pack_50",
      token: USDT,
      expectedAmount: "500000",
      chainId: 42220,
      configVersion: "canary-v1",
      priceVersion: "peones-50-v1",
      requiredConfirmations: 2,
      authBinding: "client_asserted_wallet",
    });
  });
});
