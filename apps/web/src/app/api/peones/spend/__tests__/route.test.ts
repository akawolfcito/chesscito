/**
 * Tests for POST /api/peones/spend — Sprint 4 commit C.
 *
 * Pure server-side; no UI, no localStorage, no telemetry. The
 * contracts pinned here:
 *   - validation surface (wallet/target/amount/idempotency/metadata)
 *   - RPC call shape (correct args; p_apply_pro_bypass = false always)
 *   - duplicate hit → 200 duplicate:true
 *   - insufficient_balance → 409
 *   - infra failures → 500
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/server/demo-signing", () => ({
  enforceOrigin: vi.fn(),
  enforceReadRateLimit: vi.fn(),
  getRequestIp: vi.fn(() => "127.0.0.1"),
}));

vi.mock("@/lib/supabase/server", () => ({
  getSupabaseServer: vi.fn(),
}));

vi.mock("@/lib/server/logger", () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

import { POST } from "../route";
import { getSupabaseServer } from "@/lib/supabase/server";

const mockedSupabase = vi.mocked(getSupabaseServer);

const W = "0xabcdef0123456789abcdef0123456789abcdef01";

function makeRequest(body: unknown | string): Request {
  return new Request("http://localhost/api/peones/spend", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

function baseBody(over: Partial<Record<string, unknown>> = {}) {
  return {
    wallet: W,
    amount: 1,
    target: "hint",
    targetId: "rook:r-1:3",
    idempotencyKey: `spend:hint:${W}:rook:r-1:3`,
    ...over,
  };
}

type RpcArgs = Record<string, unknown>;

function buildSupabaseMock(opts: {
  rpcResult?: {
    data:
      | Array<{
          ledger_id: number | null;
          debited: number;
          new_balance: number;
          duplicate: boolean;
          pro_bypass_applied: boolean;
        }>
      | null;
    error: { code?: string; message?: string } | null;
  };
}) {
  const captured: RpcArgs[] = [];
  const rpc = vi.fn().mockImplementation((_fn: string, args: RpcArgs) => {
    captured.push(args);
    return Promise.resolve(
      opts.rpcResult ?? {
        data: [
          {
            ledger_id: 42,
            debited: 1,
            new_balance: 9,
            duplicate: false,
            pro_bypass_applied: false,
          },
        ],
        error: null,
      },
    );
  });
  const client = { rpc } as unknown as ReturnType<typeof getSupabaseServer>;
  return { client, captured, rpc };
}

beforeEach(() => {
  vi.clearAllMocks();
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe("POST /api/peones/spend — validation", () => {
  it("400 invalid_input when body is not JSON", async () => {
    const res = await POST(makeRequest("not-json"));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "invalid_input" });
  });

  it("400 invalid_wallet when wallet is malformed", async () => {
    const res = await POST(makeRequest(baseBody({ wallet: "0xnotvalid" })));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "invalid_wallet" });
  });

  it("400 unknown_target when target is not in Sprint 4 allow-list", async () => {
    const res = await POST(
      makeRequest(baseBody({ target: "labyrinth_key" })),
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "unknown_target" });
  });

  it("400 invalid_amount when client sends amount != server cost", async () => {
    const res = await POST(makeRequest(baseBody({ amount: 99 })));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "invalid_amount" });
  });

  it("400 invalid_idempotency_key when prefix does not match target", async () => {
    const res = await POST(
      makeRequest(
        baseBody({
          target: "hint",
          idempotencyKey: `spend:coach:${W}:rook:r-1:3`,
        }),
      ),
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "invalid_idempotency_key" });
  });
});

describe("POST /api/peones/spend — infra", () => {
  it("500 ledger_unavailable when supabase client cannot be constructed", async () => {
    mockedSupabase.mockReturnValue(null);
    const res = await POST(makeRequest(baseBody()));
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "ledger_unavailable" });
  });
});

describe("POST /api/peones/spend — happy paths", () => {
  it("hint: calls RPC with amount=1 and p_apply_pro_bypass=false", async () => {
    const { client, captured } = buildSupabaseMock({});
    mockedSupabase.mockReturnValue(client);

    const res = await POST(makeRequest(baseBody()));
    expect(res.status).toBe(200);

    expect(captured.length).toBe(1);
    expect(captured[0]).toMatchObject({
      p_wallet: W,
      p_amount: 1,
      p_target: "hint",
      p_target_id: "rook:r-1:3",
      p_apply_pro_bypass: false,
    });

    const body = await res.json();
    expect(body).toMatchObject({
      wallet: W,
      target: "hint",
      targetId: "rook:r-1:3",
      requested: 1,
      debited: 1,
      newBalance: 9,
      ledgerId: 42,
      duplicate: false,
      proBypassApplied: false,
    });
    expect(body.attestationHash).toMatch(/^sha256:[0-9a-f]{64}$/);
  });

  it("retry: calls RPC with amount=2", async () => {
    const { client, captured } = buildSupabaseMock({
      rpcResult: {
        data: [
          {
            ledger_id: 51,
            debited: 2,
            new_balance: 8,
            duplicate: false,
            pro_bypass_applied: false,
          },
        ],
        error: null,
      },
    });
    mockedSupabase.mockReturnValue(client);

    const res = await POST(
      makeRequest(
        baseBody({
          amount: 2,
          target: "retry",
          targetId: "queen:q-2:7",
          idempotencyKey: `spend:retry:${W}:queen:q-2:7`,
        }),
      ),
    );
    expect(res.status).toBe(200);
    expect(captured[0]?.p_amount).toBe(2);
    expect(captured[0]?.p_target).toBe("retry");
    expect(captured[0]?.p_apply_pro_bypass).toBe(false);
  });

  it("metadata whitelist: drops unknown keys before reaching RPC", async () => {
    const { client, captured } = buildSupabaseMock({});
    mockedSupabase.mockReturnValue(client);

    await POST(
      makeRequest(
        baseBody({
          metadata: {
            gameId: "g-1",
            secret: "do-not-store",
            password: "x",
            attemptSeq: 3,
          },
        }),
      ),
    );

    expect(captured[0]?.p_metadata).toEqual({
      gameId: "g-1",
      attemptSeq: 3,
    });
  });
});

describe("POST /api/peones/spend — RPC error mapping", () => {
  it("200 duplicate:true when RPC returns duplicate=true", async () => {
    const { client } = buildSupabaseMock({
      rpcResult: {
        data: [
          {
            ledger_id: 7,
            debited: 1,
            new_balance: 12,
            duplicate: true,
            pro_bypass_applied: false,
          },
        ],
        error: null,
      },
    });
    mockedSupabase.mockReturnValue(client);

    const res = await POST(makeRequest(baseBody()));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.duplicate).toBe(true);
    expect(body.ledgerId).toBe(7);
    expect(body.newBalance).toBe(12);
  });

  it("409 insufficient_balance when RPC raises P0001", async () => {
    const { client } = buildSupabaseMock({
      rpcResult: {
        data: null,
        error: { code: "P0001", message: "insufficient_balance" },
      },
    });
    mockedSupabase.mockReturnValue(client);

    const res = await POST(makeRequest(baseBody()));
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: "insufficient_balance" });
  });

  it("409 insufficient_balance when only message identifies the cause", async () => {
    const { client } = buildSupabaseMock({
      rpcResult: {
        data: null,
        error: { code: undefined, message: "insufficient_balance" },
      },
    });
    mockedSupabase.mockReturnValue(client);

    const res = await POST(makeRequest(baseBody()));
    expect(res.status).toBe(409);
  });

  it("500 ledger_write_failed on generic RPC error", async () => {
    const { client } = buildSupabaseMock({
      rpcResult: {
        data: null,
        error: { code: "XX000", message: "boom" },
      },
    });
    mockedSupabase.mockReturnValue(client);

    const res = await POST(makeRequest(baseBody()));
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "ledger_write_failed" });
  });

  it("500 ledger_write_failed when RPC returns no row", async () => {
    const { client } = buildSupabaseMock({
      rpcResult: { data: [], error: null },
    });
    mockedSupabase.mockReturnValue(client);

    const res = await POST(makeRequest(baseBody()));
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "ledger_write_failed" });
  });
});
