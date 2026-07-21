import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const getBytecode = vi.hoisted(() => vi.fn());
const readContract = vi.hoisted(() => vi.fn());
const logInfo = vi.hoisted(() => vi.fn());
const logWarn = vi.hoisted(() => vi.fn());
const logError = vi.hoisted(() => vi.fn());
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
  createLogger: () => ({ info: logInfo, warn: logWarn, error: logError }),
  hashWallet: () => "wallet-hash",
}));
const getSupabaseServer = vi.hoisted(() => vi.fn());
vi.mock("@/lib/supabase/server", () => ({ getSupabaseServer }));

import { PATCH, POST } from "../route";

const WALLET = "0xaaaabbbbccccddddeeeeffff0000111122223333";
const USDT = "0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e";
const TREASURY = "0x1234567890abcdef1234567890abcdef12345678";
const INTENT_ID = "00000000-0000-4000-8000-000000000001";
const TX_HASH = `0x${"a".repeat(64)}`;

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

function patchRequest(body: Record<string, unknown>) {
  return new Request("http://localhost/api/payment-intents/get-peones", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function submissionStore(row: Record<string, unknown> | null) {
  const updates: Array<Record<string, unknown>> = [];
  return {
    updates,
    client: {
      from: () => ({
        select: () => ({
          eq: () => ({ maybeSingle: vi.fn().mockResolvedValue({ data: row, error: null }) }),
        }),
        update: (values: Record<string, unknown>) => {
          updates.push(values);
          return { eq: vi.fn().mockResolvedValue({ error: null }) };
        },
      }),
    },
  };
}

function intentCreationStore(unresolved: Record<string, unknown> | null = null) {
  const query = {
    eq: vi.fn(),
    in: vi.fn(),
    order: vi.fn(),
    limit: vi.fn(),
    maybeSingle: vi.fn().mockResolvedValue({ data: unresolved, error: null }),
  };
  query.eq.mockReturnValue(query);
  query.in.mockReturnValue(query);
  query.order.mockReturnValue(query);
  query.limit.mockReturnValue(query);
  const createdIntent = {
    id: INTENT_ID,
    wallet: WALLET,
    sku: "peones_pack_50",
    token_address: USDT.toLowerCase(),
    token_symbol: "USDT",
    token_decimals: 6,
    expected_amount: "500000",
    chain_id: 42220,
    treasury_address: TREASURY.toLowerCase(),
    config_version: "canary-v1",
    price_version: "peones-50-v1",
    required_confirmations: 2,
    auth_binding: "client_asserted_wallet",
    expires_at: new Date(Date.now() + 600_000).toISOString(),
    lifecycle_status: "CREATED",
    tx_hash: null,
    provider_result_kind: null,
    last_error_code: null,
    recoverable: true,
    retry_safe: true,
  };
  return {
    from: () => ({
      select: () => query,
    }),
    rpc: vi.fn().mockResolvedValue({
      data: [{ intent: createdIntent, created: true }],
      error: null,
    }),
  };
}

beforeEach(() => {
  for (const key of ENV_KEYS) delete process.env[key];
  getBytecode.mockResolvedValue("0x6000");
  readContract.mockResolvedValueOnce(true).mockResolvedValueOnce(6);
  getSupabaseServer.mockReturnValue(intentCreationStore());
  logInfo.mockReset();
  logWarn.mockReset();
  logError.mockReset();
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
    getSupabaseServer.mockReturnValue(submissionStore(null).client);
    const response = await PATCH(patchRequest({
      intentId: INTENT_ID,
      event: "unknown_submission_state",
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
      token: USDT.toLowerCase(),
      expectedAmount: "500000",
      chainId: 42220,
      configVersion: "canary-v1",
      priceVersion: "peones-50-v1",
      requiredConfirmations: 2,
      authBinding: "client_asserted_wallet",
      lifecycle: "CREATED",
      txHash: null,
      recoverable: true,
      retrySafe: true,
    });
  });

  it("reuses a transactionally returned CREATED intent instead of creating another", async () => {
    configure();
    const store = intentCreationStore();
    const rpc = vi.fn().mockResolvedValueOnce({
      data: [{
        intent: {
          id: INTENT_ID,
          wallet: WALLET,
          sku: "peones_pack_50",
          token_address: USDT.toLowerCase(),
          token_symbol: "USDT",
          token_decimals: 6,
          expected_amount: "500000",
          chain_id: 42220,
          treasury_address: TREASURY.toLowerCase(),
          config_version: "canary-v1",
          price_version: "peones-50-v1",
          required_confirmations: 2,
          auth_binding: "client_asserted_wallet",
          expires_at: new Date(Date.now() + 600_000).toISOString(),
          lifecycle_status: "CREATED",
          tx_hash: null,
          provider_result_kind: null,
          last_error_code: null,
          recoverable: true,
          retry_safe: true,
        },
        created: false,
      }],
      error: null,
    });
    store.rpc = rpc;
    getSupabaseServer.mockReturnValue(store);
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect((await response.json()).intent.id).toBe(INTENT_ID);
    expect(rpc).toHaveBeenCalledTimes(1);
  });

  // The lock has TWO doors: the pre-flight lookup, and the row the creation RPC
  // hands back for idempotency. Fixing only the first left the deadlock fully
  // intact behind the second — production still returned 409 on 2026-07-21
  // 06:56 UTC, after the RPC had already run. One rule, both doors.
  function rpcReturning(intent: Record<string, unknown>) {
    const store = intentCreationStore();
    store.rpc = vi.fn().mockResolvedValueOnce({
      data: [{
        intent: {
          id: INTENT_ID,
          wallet: WALLET,
          sku: "peones_pack_50",
          token_address: USDT.toLowerCase(),
          token_symbol: "USDT",
          token_decimals: 6,
          expected_amount: "500000",
          chain_id: 42220,
          treasury_address: TREASURY.toLowerCase(),
          config_version: "canary-v1",
          price_version: "peones-50-v1",
          required_confirmations: 2,
          auth_binding: "client_asserted_wallet",
          provider_result_kind: null,
          last_error_code: null,
          recoverable: true,
          retry_safe: false,
          ...intent,
        },
        created: false,
      }],
      error: null,
    });
    return store;
  }

  // Scoped to what the route alone can promise: it must not report the caller
  // as payment-locked. It cannot return a usable intent here, because the RPC
  // handed back a dead row instead of minting a fresh one — that half lives in
  // create_get_peones_intent, which selects CREATED/SUBMITTING/SUBMITTED with
  // no expiry filter of its own.
  it("does not report a payment lock when the RPC returns a submission that expired without a hash", async () => {
    configure();
    getSupabaseServer.mockReturnValue(rpcReturning({
      lifecycle_status: "SUBMITTING",
      tx_hash: null,
      expires_at: new Date(Date.now() - 600_000).toISOString(),
    }));
    const response = await POST(request());
    expect(response.status).not.toBe(409);
  });

  it("still blocks when the RPC returns an expired submission that carries a hash", async () => {
    configure();
    getSupabaseServer.mockReturnValue(rpcReturning({
      lifecycle_status: "SUBMITTED",
      tx_hash: TX_HASH,
      expires_at: new Date(Date.now() - 600_000).toISOString(),
    }));
    const response = await POST(request());
    expect(response.status).toBe(409);
  });

  it("still blocks when the RPC returns a submission whose window is open", async () => {
    configure();
    getSupabaseServer.mockReturnValue(rpcReturning({
      lifecycle_status: "SUBMITTING",
      tx_hash: null,
      expires_at: new Date(Date.now() + 600_000).toISOString(),
    }));
    const response = await POST(request());
    expect(response.status).toBe(409);
  });

  it("blocks a fresh intent when reload finds an unresolved persisted submission", async () => {
    configure();
    getSupabaseServer.mockReturnValue(intentCreationStore({
      id: INTENT_ID,
      lifecycle_status: "SUBMITTED",
      tx_hash: TX_HASH,
    }));
    const response = await POST(request());
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({
      error: "unresolved_submission_state",
      intentId: INTENT_ID,
      lifecycle: "SUBMITTED",
      txHash: TX_HASH,
      recoverable: true,
      retrySafe: false,
    });
  });

  // An unresolved intent locks the wallet out of buying again — that lock is
  // what stops a double charge. But it MUST expire: an intent that timed out
  // without ever broadcasting has no transfer to reconcile, so keeping the
  // lock turns one transient failure into a permanent denial of service.
  // Five such rows deadlocked the founder's wallet on 2026-07-21; two other
  // wallets sat locked since 2026-07-01. See
  // docs/audits/2026-07-20-payments-rail-gas-regression-diagnosis.md §2.
  it("lets a fresh intent through when the unresolved submission expired without a transaction hash", async () => {
    configure();
    getSupabaseServer.mockReturnValue(intentCreationStore({
      id: INTENT_ID,
      lifecycle_status: "SUBMITTING",
      tx_hash: null,
      expires_at: new Date(Date.now() - 600_000).toISOString(),
    }));
    const response = await POST(request());
    expect(response.status).toBe(200);
  });

  // The other half of the rule: expiry alone must never release the lock. A
  // hash means a transfer may be on-chain, so that intent keeps blocking until
  // the verifier resolves it — no matter how old it is.
  it("keeps blocking an expired submission that carries a transaction hash", async () => {
    configure();
    getSupabaseServer.mockReturnValue(intentCreationStore({
      id: INTENT_ID,
      lifecycle_status: "SUBMITTED",
      tx_hash: TX_HASH,
      expires_at: new Date(Date.now() - 600_000).toISOString(),
    }));
    const response = await POST(request());
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({
      error: "unresolved_submission_state",
      txHash: TX_HASH,
    });
  });

  it("rejects SUBMITTED without a transaction hash as recoverable invalid input", async () => {
    const store = submissionStore({ id: INTENT_ID, lifecycle_status: "SUBMITTING", tx_hash: null });
    getSupabaseServer.mockReturnValue(store.client);
    const response = await PATCH(patchRequest({
      intentId: INTENT_ID,
      submissionState: "SUBMITTED",
      providerResultKind: "TRANSACTION_HASH",
    }));
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      ok: false,
      error: "INVALID_SUBMISSION_STATE",
      intentId: INTENT_ID,
      recoverable: true,
    });
    expect(store.updates).toHaveLength(0);
  });

  it("rejects a follow-up report with no submission state", async () => {
    const store = submissionStore({ id: INTENT_ID, lifecycle_status: "CREATED", tx_hash: null });
    getSupabaseServer.mockReturnValue(store.client);
    const response = await PATCH(patchRequest({ intentId: INTENT_ID }));
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      error: "INVALID_SUBMISSION_STATE",
      recoverable: true,
    });
    expect(store.updates).toHaveLength(0);
  });

  it("retains SUBMITTING and blocks rebroadcast for an ambiguous provider failure", async () => {
    const store = submissionStore({ id: INTENT_ID, lifecycle_status: "SUBMITTING", tx_hash: null });
    getSupabaseServer.mockReturnValue(store.client);
    const response = await PATCH(patchRequest({
      intentId: INTENT_ID,
      submissionState: "SUBMITTING",
      providerResultKind: "AMBIGUOUS_ERROR",
      errorCode: "PROVIDER_ERROR",
    }));
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({
      error: "UNKNOWN_SUBMISSION_STATE",
      lifecycle: "SUBMITTING",
      recoverable: true,
      retrySafe: false,
    });
    expect(store.updates[0]).toMatchObject({
      lifecycle_status: "SUBMITTING",
      tx_hash: null,
      provider_result_kind: "AMBIGUOUS_ERROR",
      retry_safe: false,
    });
  });

  it("logs only allowlisted, server-redacted provider diagnostics", async () => {
    const store = submissionStore({ id: INTENT_ID, lifecycle_status: "SUBMITTING", tx_hash: null });
    getSupabaseServer.mockReturnValue(store.client);
    const calldata = `0x${"ab".repeat(80)}`;
    const response = await PATCH(patchRequest({
      intentId: INTENT_ID,
      submissionState: "SUBMITTING",
      providerResultKind: "AMBIGUOUS_ERROR",
      errorCode: "-1",
      diagnostics: {
        stage: "WALLET_REQUEST",
        connectorId: "injected",
        walletClientKind: "json-rpc",
        chainId: 42220,
        isMiniPay: true,
        error: {
          name: "ContractFunctionExecutionError",
          code: "-1",
          shortMessage: `rejected ${calldata}`,
          details: `raw request ${calldata}`,
          causeName: "UnknownRpcError",
          causeCode: "-1",
          causeShortMessage: "unknown provider failure",
          stack: "must never be logged",
        },
      },
    }));

    expect(response.status).toBe(409);
    expect(logWarn).toHaveBeenCalledWith("unknown_submission_state", expect.objectContaining({
      submission_stage: "WALLET_REQUEST",
      error_name: "ContractFunctionExecutionError",
      provider_error_code: "-1",
      error_short_message: "rejected [redacted_hex]",
      error_details: "raw request [redacted_hex]",
      cause_name: "UnknownRpcError",
      cause_code: "-1",
      connector_id: "injected",
      wallet_client_kind: "json-rpc",
      observed_chain_id: 42220,
      is_minipay: true,
    }));
    const logged = JSON.stringify(logWarn.mock.calls[0]);
    expect(logged).not.toContain(calldata);
    expect(logged).not.toContain("must never be logged");
  });

  it("normalizes the legacy unknown event into the recoverable lifecycle", async () => {
    const store = submissionStore({ id: INTENT_ID, lifecycle_status: null, tx_hash: null });
    getSupabaseServer.mockReturnValue(store.client);
    const response = await PATCH(patchRequest({
      intentId: INTENT_ID,
      event: "unknown_submission_state",
    }));
    expect(response.status).toBe(409);
    expect(store.updates[0]).toMatchObject({
      lifecycle_status: "SUBMITTING",
      last_error_code: "LEGACY_UNKNOWN_SUBMISSION_STATE",
    });
  });

  it("accepts an idempotent repeated SUBMITTED report with the same hash", async () => {
    const store = submissionStore({ id: INTENT_ID, lifecycle_status: "SUBMITTED", tx_hash: TX_HASH });
    getSupabaseServer.mockReturnValue(store.client);
    const report = {
      intentId: INTENT_ID,
      submissionState: "SUBMITTED",
      providerResultKind: "TRANSACTION_HASH",
      txHash: TX_HASH,
    };
    const [first, second] = await Promise.all([
      PATCH(patchRequest(report)),
      PATCH(patchRequest(report)),
    ]);
    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(store.updates).toHaveLength(2);
  });
});
