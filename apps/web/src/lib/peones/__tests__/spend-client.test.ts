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

function baseArgs(over: Partial<Record<string, unknown>> = {}) {
  return {
    wallet: W,
    amount: 1,
    target: "hint" as const,
    targetId: "rook:r-1:3",
    idempotencyKey: `spend:hint:${W}:rook:r-1:3`,
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
 * P0 rollout step 1 (2026-08-10) — the spend must PROVE the wallet it debits.
 *
 * The server stops trusting `wallet` from the body and resolves it from a
 * signed score write-session instead. It can only do that if this helper sends
 * the token, so the client ships FIRST, with the flag still off. The token is
 * one the player already holds: no new signature, no prompt.
 *
 * It is attached HERE, in the single choke point all three sinks (hint, coach,
 * shield) funnel through, for the same reason the peones-changed dispatch lives
 * here — so no sink can forget it.
 */
describe("submitPeonesSpend — session token (P0 rollout step 1)", () => {
  /** REAL shape, not a placeholder: `createSessionToken()` is
   *  `randomBytes(32).toString("hex")`, and the server's reader only accepts
   *  `/^Bearer ([0-9a-f]{64})$/`. A test token of any other shape would pass
   *  here and still be rejected in production the moment the flag flips. */
  const TOKEN = "a".repeat(64);
  const session = { token: TOKEN, wallet: W, surface: "learn" as const, expiresAt: 9e9, maxSaves: 5 };

  function headersOf(fetchImpl: ReturnType<typeof vi.fn>): Record<string, string> {
    return (fetchImpl.mock.calls[0][1] as RequestInit).headers as Record<string, string>;
  }

  it("attaches Authorization: Bearer <token> when a session is cached", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(200, happyBody()));

    await submitPeonesSpend(baseArgs({ fetchImpl, peekSessionImpl: () => session }));

    expect(headersOf(fetchImpl).Authorization).toBe(`Bearer ${TOKEN}`);
  });

  it("OMITS the header entirely when there is no session", async () => {
    // Not an empty string, not "Bearer undefined": with the flag off the route
    // must stay byte-for-byte its old self, and a header that exists but is
    // meaningless is not that.
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(200, happyBody()));

    await submitPeonesSpend(baseArgs({ fetchImpl, peekSessionImpl: () => null }));

    expect(headersOf(fetchImpl)).not.toHaveProperty("Authorization");
  });

  it("keeps Content-Type in both cases", async () => {
    const withToken = vi.fn().mockResolvedValue(jsonResponse(200, happyBody()));
    const without = vi.fn().mockResolvedValue(jsonResponse(200, happyBody()));

    await submitPeonesSpend(baseArgs({ fetchImpl: withToken, peekSessionImpl: () => session }));
    await submitPeonesSpend(baseArgs({ fetchImpl: without, peekSessionImpl: () => null }));

    expect(headersOf(withToken)["Content-Type"]).toBe("application/json");
    expect(headersOf(without)["Content-Type"]).toBe("application/json");
  });

  it("sends a token whose wallet differs — the SERVER decides, not us", async () => {
    // Silently withholding it would turn a 401 into a legacy-path debit the
    // moment the flag flips. The route compares and answers 401; that is the
    // trust boundary, and it does not live in the client.
    const other = { ...session, wallet: "0x0000000000000000000000000000000000000001" };
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(200, happyBody()));

    await submitPeonesSpend(baseArgs({ fetchImpl, peekSessionImpl: () => other }));

    expect(headersOf(fetchImpl).Authorization).toBe(`Bearer ${TOKEN}`);
  });

  it("NEVER throws if reading the session throws", async () => {
    // "Never throws" is this module's stated invariant. A broken session store
    // must not become an exception on a spend.
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(200, happyBody()));

    const result = await submitPeonesSpend(
      baseArgs({
        fetchImpl,
        peekSessionImpl: () => {
          throw new Error("session store exploded");
        },
      }),
    );

    expect(result.kind).toBe("success");
    expect(headersOf(fetchImpl)).not.toHaveProperty("Authorization");
  });

  /**
   * THE TEST THAT MATTERS FOR THE FLAG FLIP.
   *
   * Everything above proves the client SENDS a header. This proves the server
   * ACCEPTS the exact header it sends. The two live in different modules with
   * no shared type between them — the client forwards an opaque string and the
   * server parses it with a regex — so nothing but this assertion would catch a
   * drift in token shape. The failure mode it prevents is the expensive one:
   * green tests, a clean deploy, and every spend 401ing the moment the flag
   * turns on.
   */
  it("sends a header the SERVER's own reader accepts", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(200, happyBody()));

    await submitPeonesSpend(baseArgs({ fetchImpl, peekSessionImpl: () => session }));

    const sent = headersOf(fetchImpl).Authorization;
    const reconstructed = new Request("https://example.test/api/peones/spend", {
      method: "POST",
      headers: { authorization: sent },
    });

    expect(readSpendBearerToken(reconstructed)).toBe(TOKEN);
  });

  it("does not send the token in the body — it is a header, not a payload field", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(200, happyBody()));

    await submitPeonesSpend(baseArgs({ fetchImpl, peekSessionImpl: () => session }));

    const body = JSON.parse((fetchImpl.mock.calls[0][1] as RequestInit).body as string);
    expect(JSON.stringify(body)).not.toContain(TOKEN);
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
