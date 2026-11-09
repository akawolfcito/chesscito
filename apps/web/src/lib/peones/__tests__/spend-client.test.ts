/**
 * Sprint 4 commit D — spend client helper tests.
 *
 * Pure tests: the helper is fetched via dependency injection
 * (`fetchImpl`) so no global mock is needed and no localStorage is
 * touched. The contract assertions:
 *   - happy path → kind:"success" with mapped fields
 *   - 409       → kind:"insufficient_balance"
 *   - 400/429/500 → kind:"error" forwarding the server's error code
 *   - network throw → kind:"error" with reason "network"
 *   - bad JSON  → kind:"error" with reason "bad_response"
 *   - metadata passes through to the fetch body verbatim
 *   - localStorage NEVER read or written
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { submitPeonesSpend } from "@/lib/peones/spend-client";
import { subscribeToPeonesChanges } from "@/lib/peones/peones-events";
import { readSpendBearerToken } from "@/lib/scores/spend-session-guard";

const W = "0xabcdef0123456789abcdef0123456789abcdef01";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function happyBody(over: Partial<Record<string, unknown>> = {}) {
  return {
    wallet: W,
    target: "hint",
    targetId: "rook:r-1:3",
    requested: 1,
    debited: 1,
    newBalance: 9,
    attestationHash: "sha256:abc",
    ledgerId: 42,
    duplicate: false,
    proBypassApplied: false,
    ...over,
  };
}

const TOKEN = "a".repeat(64);
const SESSION = {
  token: TOKEN,
  wallet: W,
  surface: "learn" as const,
  expiresAt: 9e9,
  maxSaves: 5,
};

/** The signer these tests hand in. It THROWS: by default every test supplies a
 *  session through `ensureSessionImpl`, so reaching the signer means the spend
 *  tried to mint when it should not have — and that should fail loudly. */
const neverSigns = async (): Promise<string> => {
  throw new Error("signer must not be reached in this test");
};

function baseArgs(over: Partial<Record<string, unknown>> = {}) {
  return {
    wallet: W,
    amount: 1,
    target: "hint" as const,
    targetId: "rook:r-1:3",
    idempotencyKey: `spend:hint:${W}:rook:r-1:3`,
    signMessage: neverSigns,
    // Default: a session already exists, so the spend never mints. Tests about
    // acquisition override this explicitly.
    ensureSessionImpl: async () => SESSION,
    ...over,
  };
}

let localStorageSpy: ReturnType<typeof vi.spyOn> | null = null;
let localStorageSetSpy: ReturnType<typeof vi.spyOn> | null = null;

beforeEach(() => {
  // Tripwire — if the helper ever reads/writes localStorage we fail.
  if (typeof window !== "undefined" && window.localStorage) {
    localStorageSpy = vi.spyOn(window.localStorage, "getItem");
    localStorageSetSpy = vi.spyOn(window.localStorage, "setItem");
  }
});
afterEach(() => {
  localStorageSpy?.mockRestore();
  localStorageSetSpy?.mockRestore();
  vi.restoreAllMocks();
});

/**
 * CALLER AUTHORIZATION (P0, 2026-08-10) — the spend proves the wallet it debits.
 *
 * The server stops trusting `wallet` from the body and resolves it from a signed
 * score write-session. The rule this suite pins: a spend may ALWAYS acquire that
 * session, because a spend is always something the player asked for. Verified
 * across the three sinks — hint is an `onClick`, the shield runs inside
 * `onUseShield`, the coach inside `startCoachAnalysis`.
 *
 * Why acquiring and not merely reading: the session lives 2h, so "no usable
 * session" is the ordinary state of a player returning the next day, not an
 * edge case.
 */
describe("submitPeonesSpend — session acquisition", () => {
  function headersOf(fetchImpl: ReturnType<typeof vi.fn>): Record<string, string> {
    return (fetchImpl.mock.calls[0]![1] as RequestInit).headers as Record<string, string>;
  }

  it("sends Authorization: Bearer <token> from the acquired session", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(200, happyBody()));

    await submitPeonesSpend(baseArgs({ fetchImpl }));

    expect(headersOf(fetchImpl).Authorization).toBe(`Bearer ${TOKEN}`);
    expect(headersOf(fetchImpl)["Content-Type"]).toBe("application/json");
  });

  /**
   * THE TEST THAT MATTERS FOR THE FLAG FLIP.
   *
   * Everything else proves the client SENDS a header. This proves the server
   * ACCEPTS the exact one it sends. The two live in different modules with no
   * shared type — the client forwards an opaque string, the server parses it
   * with `/^Bearer ([0-9a-f]{64})$/` — so nothing but this would catch a drift
   * in token shape. The failure it prevents is the expensive one: green tests,
   * a clean deploy, and every spend 401ing the moment the flag turns on.
   */
  it("sends a header the SERVER's own reader accepts", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(200, happyBody()));

    await submitPeonesSpend(baseArgs({ fetchImpl }));

    const reconstructed = new Request("https://example.test/api/peones/spend", {
      method: "POST",
      headers: { authorization: headersOf(fetchImpl).Authorization },
    });
    expect(readSpendBearerToken(reconstructed)).toBe(TOKEN);
  });

  it("does NOT fire the request when no session can be acquired", async () => {
    // Firing it would earn a guaranteed 401 and teach the player nothing.
    const fetchImpl = vi.fn();

    const result = await submitPeonesSpend(
      baseArgs({ fetchImpl, ensureSessionImpl: async () => null }),
    );

    expect(fetchImpl).not.toHaveBeenCalled();
    expect(result).toEqual({ kind: "error", error: "session_required" });
  });

  it("NEVER throws when acquiring the session throws", async () => {
    // "NEVER throws" is this module's stated invariant.
    const fetchImpl = vi.fn();

    const result = await submitPeonesSpend(
      baseArgs({
        fetchImpl,
        ensureSessionImpl: async () => {
          throw new Error("session store exploded");
        },
      }),
    );

    expect(result).toEqual({ kind: "error", error: "session_required" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("keeps the token OUT of the body — it is a header, not a payload field", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(200, happyBody()));

    await submitPeonesSpend(baseArgs({ fetchImpl }));

    const body = String((fetchImpl.mock.calls[0]![1] as RequestInit).body);
    expect(body).not.toContain(TOKEN);
  });

  it("rejects an invalid wallet BEFORE asking for a session", async () => {
    // Nobody should be asked to sign for a spend that cannot happen anyway.
    const ensureSessionImpl = vi.fn(async () => SESSION);
    const fetchImpl = vi.fn();

    await submitPeonesSpend(
      baseArgs({ wallet: "0xnotvalid", fetchImpl, ensureSessionImpl }),
    );

    expect(ensureSessionImpl).not.toHaveBeenCalled();
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

describe("submitPeonesSpend — happy path", () => {
  it("returns kind:'success' with mapped server fields", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(200, happyBody()));
    const result = await submitPeonesSpend({ ...baseArgs(), fetchImpl });

    expect(result).toEqual({
      kind: "success",
      wallet: W,
      target: "hint",
      targetId: "rook:r-1:3",
      requested: 1,
      debited: 1,
      newBalance: 9,
      attestationHash: "sha256:abc",
      ledgerId: 42,
      duplicate: false,
      proBypassApplied: false,
      quotaUsed: null,
      quotaLimit: null,
    });
  });

  it("POSTs the canonical payload to /api/peones/spend", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(200, happyBody()));
    await submitPeonesSpend({ ...baseArgs(), fetchImpl });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(url).toBe("/api/peones/spend");
    expect((init as RequestInit).method).toBe("POST");
    const sent = JSON.parse(String((init as RequestInit).body));
    expect(sent).toEqual({
      wallet: W,
      amount: 1,
      target: "hint",
      targetId: "rook:r-1:3",
      idempotencyKey: `spend:hint:${W}:rook:r-1:3`,
    });
  });

  it("preserves duplicate flag verbatim", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(jsonResponse(200, happyBody({ duplicate: true })));
    const result = await submitPeonesSpend({ ...baseArgs(), fetchImpl });
    expect(result.kind).toBe("success");
    if (result.kind === "success") {
      expect(result.duplicate).toBe(true);
    }
  });

  it("forwards metadata to the fetch body when provided", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(200, happyBody()));
    await submitPeonesSpend({
      ...baseArgs(),
      metadata: { gameId: "g-1", attemptSeq: 3 },
      fetchImpl,
    });
    const sent = JSON.parse(String(fetchImpl.mock.calls[0]![1].body));
    expect(sent.metadata).toEqual({ gameId: "g-1", attemptSeq: 3 });
  });

  it("omits metadata when not provided (no `metadata: undefined` in JSON)", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(200, happyBody()));
    await submitPeonesSpend({ ...baseArgs(), fetchImpl });
    const sent = JSON.parse(String(fetchImpl.mock.calls[0]![1].body));
    expect(Object.prototype.hasOwnProperty.call(sent, "metadata")).toBe(false);
  });

  it("normalises wallet to lowercase before sending", async () => {
    const upper = "0xABCDEF0123456789ABCDEF0123456789ABCDEF01";
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(200, happyBody()));
    const result = await submitPeonesSpend({
      ...baseArgs(),
      wallet: upper,
      fetchImpl,
    });
    const sent = JSON.parse(String(fetchImpl.mock.calls[0]![1].body));
    expect(sent.wallet).toBe(W);
    if (result.kind === "success") {
      expect(result.wallet).toBe(W);
    }
  });
});

describe("submitPeonesSpend — error paths", () => {
  it("invalid wallet → kind:'error' WITHOUT touching fetch", async () => {
    const fetchImpl = vi.fn();
    const result = await submitPeonesSpend({
      ...baseArgs(),
      wallet: "0xnotvalid",
      fetchImpl,
    });
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(result).toEqual({ kind: "error", error: "invalid_wallet" });
  });

  it("409 → kind:'insufficient_balance'", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(
        jsonResponse(409, { error: "insufficient_balance" }),
      );
    const result = await submitPeonesSpend({ ...baseArgs(), fetchImpl });
    expect(result).toEqual({ kind: "insufficient_balance" });
  });

  it("400 invalid_amount → kind:'error' forwarding the server error", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(jsonResponse(400, { error: "invalid_amount" }));
    const result = await submitPeonesSpend({ ...baseArgs(), fetchImpl });
    expect(result).toEqual({ kind: "error", error: "invalid_amount" });
  });

  it("429 rate_limited → kind:'error'", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(jsonResponse(429, { error: "rate_limited" }));
    const result = await submitPeonesSpend({ ...baseArgs(), fetchImpl });
    expect(result).toEqual({ kind: "error", error: "rate_limited" });
  });

  it("500 ledger_write_failed → kind:'error'", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(jsonResponse(500, { error: "ledger_write_failed" }));
    const result = await submitPeonesSpend({ ...baseArgs(), fetchImpl });
    expect(result).toEqual({ kind: "error", error: "ledger_write_failed" });
  });

  it("500 with unparseable body → kind:'error' with http_<status> fallback", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(new Response("not json", { status: 500 }));
    const result = await submitPeonesSpend({ ...baseArgs(), fetchImpl });
    expect(result).toEqual({ kind: "error", error: "http_500" });
  });

  it("network throw → kind:'error' with reason 'network'", async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error("offline"));
    const result = await submitPeonesSpend({ ...baseArgs(), fetchImpl });
    expect(result).toEqual({ kind: "error", error: "network" });
  });

  it("200 with unparseable body → kind:'error' with reason 'bad_response'", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(new Response("not json", { status: 200 }));
    const result = await submitPeonesSpend({ ...baseArgs(), fetchImpl });
    expect(result).toEqual({ kind: "error", error: "bad_response" });
  });

  it("200 with missing attestationHash → kind:'error' bad_response", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(
        jsonResponse(200, happyBody({ attestationHash: null })),
      );
    const result = await submitPeonesSpend({ ...baseArgs(), fetchImpl });
    expect(result).toEqual({ kind: "error", error: "bad_response" });
  });
});

describe("submitPeonesSpend — no side effects", () => {
  it("does NOT read or write localStorage in the happy path", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(200, happyBody()));
    await submitPeonesSpend({ ...baseArgs(), fetchImpl });
    expect(localStorageSpy).not.toHaveBeenCalled();
    expect(localStorageSetSpy).not.toHaveBeenCalled();
  });

  it("does NOT read or write localStorage on error paths", async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error("offline"));
    await submitPeonesSpend({ ...baseArgs(), fetchImpl });
    expect(localStorageSpy).not.toHaveBeenCalled();
    expect(localStorageSetSpy).not.toHaveBeenCalled();
  });
});

describe("submitPeonesSpend — balance-change bus", () => {
  it("dispatches a change after a confirmed debit", async () => {
    const handler = vi.fn();
    const unsubscribe = subscribeToPeonesChanges(handler);
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(200, happyBody()));

    await submitPeonesSpend(baseArgs({ fetchImpl }));

    expect(handler).toHaveBeenCalledTimes(1);
    unsubscribe();
  });

  it("does NOT dispatch on insufficient balance — nothing was debited", async () => {
    const handler = vi.fn();
    const unsubscribe = subscribeToPeonesChanges(handler);
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(jsonResponse(409, { error: "insufficient_balance" }));

    await submitPeonesSpend(baseArgs({ fetchImpl }));

    expect(handler).not.toHaveBeenCalled();
    unsubscribe();
  });

  it("does NOT dispatch on a server error", async () => {
    const handler = vi.fn();
    const unsubscribe = subscribeToPeonesChanges(handler);
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(jsonResponse(500, { error: "ledger_unavailable" }));

    await submitPeonesSpend(baseArgs({ fetchImpl }));

    expect(handler).not.toHaveBeenCalled();
    unsubscribe();
  });

  it("does NOT dispatch when the network throws", async () => {
    const handler = vi.fn();
    const unsubscribe = subscribeToPeonesChanges(handler);
    const fetchImpl = vi.fn().mockRejectedValue(new Error("offline"));

    await submitPeonesSpend(baseArgs({ fetchImpl }));

    expect(handler).not.toHaveBeenCalled();
    unsubscribe();
  });
});
