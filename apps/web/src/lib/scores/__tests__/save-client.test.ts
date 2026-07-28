/**
 * SaveScore off-chain — Slice 5 client seam.
 *
 * `postScoreSave` is the thin client that REPLACES the on-chain
 * sign-score + submitScoreSigned path in the base game loop. It derives
 * the saveId, POSTs /api/scores/save, and maps the HTTP response onto the
 * shared `BasicScoreSaveResult` union the UI renders.
 *
 * These tests pin the contract the UI rewire depends on:
 *   - the request hits /api/scores/save (NEVER /api/sign-score);
 *   - the body carries the deterministic saveId derived from
 *     (player, levelId, gameId=String(score));
 *   - every documented status maps cleanly (saved/free, saved/peones,
 *     duplicate, insufficient_peones, rate_limited, invalid, error);
 *   - a thrown fetch degrades to a controlled error (never a throw the
 *     caller has to catch, never a silent "saved").
 *   - the module imports NO contract / signing machinery (off-chain only).
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { postScoreSave, createScoreSaveNonce } from "../save-client";
import { parseScoreSaveMessage } from "../save-authorization";

const PLAYER = "0x1234567890123456789012345678901234567890" as const;

/** Stand-in for `signMessageAsync`. Records what it was asked to sign so the
 *  tests can assert on the canonical message the wallet actually shows. */
function stubSigner() {
  const signed: string[] = [];
  const fn = vi.fn(async ({ message }: { message: string }) => {
    signed.push(message);
    return `0x${"ab".repeat(65)}`;
  });
  return { fn, signed };
}

const BASE = {
  player: PLAYER,
  levelId: 1,
  score: 300,
  timeMs: 5000,
  surface: "learn" as const,
  chainId: 42220,
  signMessage: stubSigner().fn,
};

function mockFetch(status: number, body: unknown) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as unknown as Response);
}

const QUOTA = {
  wallet: PLAYER.toLowerCase(),
  freeLimit: 5,
  freeUsed: 1,
  freeRemaining: 4,
  requiresPeones: false,
  costPeones: 0,
};

describe("postScoreSave — request shape", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("POSTs to /api/scores/save (NEVER /api/sign-score)", async () => {
    const fetchImpl = mockFetch(200, { status: "saved", mode: "free", quota: QUOTA });
    await postScoreSave(BASE, fetchImpl);

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(url).toBe("/api/scores/save");
    expect(url).not.toMatch(/sign-score/);
    expect((init as RequestInit).method).toBe("POST");
  });

  it("sends ONLY the signed message and its signature", async () => {
    // Slice 0: every value the server acts on must be inside the signature.
    // A field alongside it is a field an attacker can rewrite in flight.
    const fetchImpl = mockFetch(200, { status: "saved", mode: "free", quota: QUOTA });
    const signer = stubSigner();
    await postScoreSave({ ...BASE, signMessage: signer.fn }, fetchImpl);

    const init = fetchImpl.mock.calls[0]![1] as RequestInit;
    const sent = JSON.parse(String(init.body));

    expect(Object.keys(sent).sort()).toEqual(["message", "signature"]);
    expect(sent.player).toBeUndefined();
    expect(sent.saveId).toBeUndefined();
  });

  it("signs the canonical payload the server parses back", async () => {
    const fetchImpl = mockFetch(200, { status: "saved", mode: "free", quota: QUOTA });
    const signer = stubSigner();
    await postScoreSave({ ...BASE, signMessage: signer.fn }, fetchImpl, 1_800_000_000_000);

    expect(signer.fn).toHaveBeenCalledTimes(1);
    const claim = parseScoreSaveMessage(signer.signed[0]!);
    expect(claim).toMatchObject({
      chainId: 42220,
      player: PLAYER.toLowerCase(),
      surface: "learn",
      levelId: 1,
      score: 300,
      timeMs: 5000,
    });
    // The body carries the exact bytes that were signed — no rebuild.
    const sent = JSON.parse(String((fetchImpl.mock.calls[0]![1] as RequestInit).body));
    expect(sent.message).toBe(signer.signed[0]);
  });

  it("mints a validity window, not an open-ended authorization", async () => {
    const fetchImpl = mockFetch(200, { status: "saved", mode: "free", quota: QUOTA });
    const signer = stubSigner();
    await postScoreSave({ ...BASE, signMessage: signer.fn }, fetchImpl, 1_800_000_000_000);

    const claim = parseScoreSaveMessage(signer.signed[0]!)!;
    expect(claim.issuedAt).toBe(1_800_000_000);
    expect(claim.expiresAt).toBeGreaterThan(claim.issuedAt);
    expect(claim.expiresAt - claim.issuedAt).toBeLessThanOrEqual(300);
  });

  it("uses a fresh nonce per save so one authorization cannot be reused", async () => {
    const fetchImpl = mockFetch(200, { status: "saved", mode: "free", quota: QUOTA });
    const signer = stubSigner();
    await postScoreSave({ ...BASE, signMessage: signer.fn }, fetchImpl);
    await postScoreSave({ ...BASE, signMessage: signer.fn }, fetchImpl);

    const first = parseScoreSaveMessage(signer.signed[0]!)!;
    const second = parseScoreSaveMessage(signer.signed[1]!)!;
    expect(first.nonce).not.toBe(second.nonce);
  });

  it("reports a rejected signature instead of pretending it saved", async () => {
    const fetchImpl = mockFetch(200, { status: "saved", mode: "free", quota: QUOTA });
    const r = await postScoreSave(
      { ...BASE, signMessage: vi.fn().mockRejectedValue(new Error("User rejected")) },
      fetchImpl,
    );
    expect(r).toEqual({ status: "error", reason: "signature_rejected" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

describe("createScoreSaveNonce", () => {
  it("produces 32 lowercase hex chars (128 bits)", () => {
    expect(createScoreSaveNonce()).toMatch(/^[0-9a-f]{32}$/);
  });

  it("zero-pads low bytes so the nonce is always full width", () => {
    const nonce = createScoreSaveNonce(() => new Uint8Array(16));
    expect(nonce).toBe("0".repeat(32));
  });
});

describe("postScoreSave — status mapping", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("maps 200 saved/free", async () => {
    const r = await postScoreSave(BASE, mockFetch(200, { status: "saved", mode: "free", quota: QUOTA }));
    expect(r).toEqual({ status: "saved", mode: "free", quota: QUOTA });
  });

  it("maps 200 saved/peones with spent", async () => {
    const r = await postScoreSave(
      BASE,
      mockFetch(200, { status: "saved", mode: "peones", spent: 1, quota: QUOTA }),
    );
    expect(r.status).toBe("saved");
    if (r.status === "saved" && r.mode === "peones") {
      expect(r.spent).toBe(1);
    } else {
      throw new Error("expected saved/peones");
    }
  });

  it("maps 200 duplicate as idempotent success", async () => {
    const r = await postScoreSave(BASE, mockFetch(200, { status: "duplicate", quota: QUOTA }));
    expect(r.status).toBe("duplicate");
  });

  it("maps 409 insufficient_peones", async () => {
    const r = await postScoreSave(
      BASE,
      mockFetch(409, { status: "insufficient_peones", required: 1, balance: 0, quota: QUOTA }),
    );
    expect(r.status).toBe("insufficient_peones");
    if (r.status === "insufficient_peones") {
      expect(r.required).toBe(1);
    }
  });

  it("maps 429 rate_limited with retryAfterMs", async () => {
    const r = await postScoreSave(BASE, mockFetch(429, { status: "rate_limited", retryAfterMs: 60000 }));
    expect(r.status).toBe("rate_limited");
    if (r.status === "rate_limited") {
      expect(r.retryAfterMs).toBe(60000);
    }
  });

  it("maps 400 invalid", async () => {
    const r = await postScoreSave(BASE, mockFetch(400, { status: "invalid", reason: "invalid_score" }));
    expect(r.status).toBe("invalid");
  });

  it("maps 500 error", async () => {
    const r = await postScoreSave(BASE, mockFetch(500, { status: "error", reason: "save_failed" }));
    expect(r.status).toBe("error");
  });

  it("maps 503 unavailable as error", async () => {
    const r = await postScoreSave(BASE, mockFetch(503, { status: "error", reason: "unavailable" }));
    expect(r.status).toBe("error");
  });

  it("degrades a thrown fetch to a controlled error (no throw, no silent saved)", async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error("network down"));
    const r = await postScoreSave(BASE, fetchImpl);
    expect(r.status).toBe("error");
  });

  it("degrades an unparseable body to a controlled error", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => {
        throw new Error("not json");
      },
    } as unknown as Response);
    const r = await postScoreSave(BASE, fetchImpl);
    expect(r.status).toBe("error");
  });

  it("rejects an unknown status payload as a controlled error", async () => {
    const r = await postScoreSave(BASE, mockFetch(200, { status: "weird_unknown" }));
    expect(r.status).toBe("error");
  });
});

describe("postScoreSave — off-chain isolation guard", () => {
  it("imports NO contract / signing machinery", () => {
    const src = readFileSync(
      join(process.cwd(), "src", "lib", "scores", "save-client.ts"),
      "utf-8",
    );
    // Strip comments — prose may NAME the retained on-chain lane; what
    // must never appear is an import/use of it.
    const code = src
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");
    // No fetch to the signing endpoint.
    expect(code).not.toMatch(/["'`][^"'`]*\/api\/sign-score/);
    // No contract write / ABI / address helpers.
    expect(code).not.toMatch(/submitScoreSigned/);
    expect(code).not.toMatch(/scoreboardAbi|getScoreboardAddress|ScoreboardAddress/);
    // No wallet stack imports.
    expect(code).not.toMatch(/from\s+["'](wagmi|viem)["']/);
    expect(code).not.toMatch(/useWriteContract|writeContract/);
  });
});
