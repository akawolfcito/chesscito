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

import { postScoreSave } from "../save-client";
import { deriveScoreSaveId } from "../save-service";

const PLAYER = "0x1234567890123456789012345678901234567890" as const;
const BASE = { player: PLAYER, levelId: 1, score: 300, timeMs: 5000 };

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

  it("derives saveId from (player, levelId, String(score)) and sends gameId", async () => {
    const fetchImpl = mockFetch(200, { status: "saved", mode: "free", quota: QUOTA });
    await postScoreSave(BASE, fetchImpl);

    const init = fetchImpl.mock.calls[0]![1] as RequestInit;
    const sent = JSON.parse(String(init.body));
    const expectedSaveId = deriveScoreSaveId(PLAYER, 1, String(300));

    expect(sent.gameId).toBe("300");
    expect(sent.saveId).toBe(expectedSaveId);
    expect(sent.player).toBe(PLAYER);
    expect(sent.levelId).toBe(1);
    expect(sent.score).toBe(300);
    expect(sent.timeMs).toBe(5000);
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
