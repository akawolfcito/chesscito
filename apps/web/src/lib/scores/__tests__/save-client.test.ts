/**
 * SaveScore off-chain — client seam (Slice 0.1).
 *
 * The property this file exists to pin is the UX one: the FIRST puntuable save
 * costs one wallet prompt, and every save after it is silent. That is the
 * whole reason the per-save signature was replaced — a prompt after every
 * exercise is a control players learn to dismiss reflexively, which trains the
 * opposite of the habit the on-chain lane depends on.
 *
 * Audit: docs/product/2026-07-27-score-and-leaders-audit.md §10.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { postScoreSave } from "../save-client";
import { clearScoreSession } from "../session-client";

const PLAYER = "0x1234567890123456789012345678901234567890" as const;
const TOKEN = "a".repeat(64);
const TOKEN_2 = "b".repeat(64);

const QUOTA = {
  wallet: PLAYER.toLowerCase(),
  freeLimit: 5,
  freeUsed: 1,
  freeRemaining: 4,
  requiresPeones: false,
  costPeones: 0,
};

const SAVED = { status: "saved", mode: "free", quota: QUOTA };

function jsonResponse(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as unknown as Response;
}

/** Scripted server: challenge → authorize → N save responses. */
function serverStub(saveResponses: Array<{ status: number; body: unknown }>) {
  let tokenIndex = 0;
  const tokens = [TOKEN, TOKEN_2];
  const saves = [...saveResponses];
  const calls: Array<{ url: string; init?: RequestInit }> = [];

  const fetchImpl = vi.fn(async (url: string, init?: RequestInit) => {
    calls.push({ url, init });
    if (url === "/api/scores/session/challenge") {
      return jsonResponse(200, {
        message: [
          "Chesscito Score Session v1",
          "chainId: 42220",
          `wallet: ${PLAYER.toLowerCase()}`,
          "surface: learn",
          "sessionId: a1b2c3d4e5f60718293a4b5c6d7e8f90",
          "issuedAt: 1800000000",
          "expiresAt: 1800007200",
          "maxSaves: 25",
        ].join("\n"),
        sessionId: "a1b2c3d4e5f60718293a4b5c6d7e8f90",
        expiresAt: 1_800_007_200,
        maxSaves: 25,
      });
    }
    if (url === "/api/scores/session/authorize") {
      const token = tokens[Math.min(tokenIndex++, tokens.length - 1)]!;
      return jsonResponse(200, { token, expiresAt: 1_800_007_200, maxSaves: 25 });
    }
    const next = saves.shift() ?? { status: 200, body: SAVED };
    return jsonResponse(next.status, next.body);
  }) as unknown as typeof fetch;

  return { fetchImpl, calls };
}

function stubSigner() {
  return vi.fn(async () => `0x${"ab".repeat(65)}`);
}

const NOW = 1_800_000_000_000;

function baseInput(signMessage: ReturnType<typeof stubSigner>) {
  return {
    player: PLAYER,
    levelId: 1,
    score: 300,
    timeMs: 5000,
    surface: "learn" as const,
    signMessage,
  };
}

describe("postScoreSave — one prompt per session", () => {
  beforeEach(() => clearScoreSession());
  afterEach(() => clearScoreSession());

  it("asks for exactly one signature on the first save", async () => {
    const { fetchImpl, calls } = serverStub([{ status: 200, body: SAVED }]);
    const signer = stubSigner();

    const r = await postScoreSave(baseInput(signer), fetchImpl, NOW);

    expect(r).toEqual(SAVED);
    expect(signer).toHaveBeenCalledTimes(1);
    expect(calls.map((c) => c.url)).toEqual([
      "/api/scores/session/challenge",
      "/api/scores/session/authorize",
      "/api/scores/save",
    ]);
  });

  it("does NOT ask again on subsequent saves", async () => {
    const { fetchImpl, calls } = serverStub([
      { status: 200, body: SAVED },
      { status: 200, body: SAVED },
      { status: 200, body: SAVED },
    ]);
    const signer = stubSigner();
    const input = baseInput(signer);

    await postScoreSave(input, fetchImpl, NOW);
    await postScoreSave({ ...input, score: 600 }, fetchImpl, NOW);
    await postScoreSave({ ...input, score: 900 }, fetchImpl, NOW);

    expect(signer).toHaveBeenCalledTimes(1);
    expect(calls.filter((c) => c.url === "/api/scores/session/challenge")).toHaveLength(1);
    expect(calls.filter((c) => c.url === "/api/scores/save")).toHaveLength(3);
  });

  it("sends the token as a Bearer header and no wallet in the body", async () => {
    const { fetchImpl, calls } = serverStub([{ status: 200, body: SAVED }]);
    await postScoreSave(baseInput(stubSigner()), fetchImpl, NOW);

    const save = calls.find((c) => c.url === "/api/scores/save")!;
    const headers = save.init!.headers as Record<string, string>;
    expect(headers.authorization).toBe(`Bearer ${TOKEN}`);

    const sent = JSON.parse(String(save.init!.body));
    expect(Object.keys(sent).sort()).toEqual(["levelId", "score", "timeMs"]);
    expect(sent.player).toBeUndefined();
  });

  it("produces ONE prompt when two saves race on the same tick", async () => {
    // Without in-flight coalescing the player gets two prompts back to back
    // for one session — the exact confusion this slice exists to remove.
    const { fetchImpl, calls } = serverStub([
      { status: 200, body: SAVED },
      { status: 200, body: SAVED },
    ]);
    const signer = stubSigner();
    const input = baseInput(signer);

    await Promise.all([
      postScoreSave(input, fetchImpl, NOW),
      postScoreSave({ ...input, score: 600 }, fetchImpl, NOW),
    ]);

    expect(signer).toHaveBeenCalledTimes(1);
    expect(calls.filter((c) => c.url === "/api/scores/session/authorize")).toHaveLength(1);
  });
});

describe("postScoreSave — expiry and retry", () => {
  beforeEach(() => clearScoreSession());
  afterEach(() => clearScoreSession());

  it("re-authorizes once and replays the save when the server says the session died", async () => {
    const { fetchImpl, calls } = serverStub([
      { status: 401, body: { status: "invalid", reason: "session_expired" } },
      { status: 200, body: SAVED },
    ]);
    const signer = stubSigner();

    const r = await postScoreSave(baseInput(signer), fetchImpl, NOW);

    expect(r).toEqual(SAVED);
    expect(signer).toHaveBeenCalledTimes(2);
    expect(calls.filter((c) => c.url === "/api/scores/save")).toHaveLength(2);
    // The replay used the NEW token, not the dead one.
    const second = calls.filter((c) => c.url === "/api/scores/save")[1]!;
    expect((second.init!.headers as Record<string, string>).authorization).toBe(
      `Bearer ${TOKEN_2}`,
    );
  });

  it.each([
    "invalid_session",
    "session_expired",
    "session_revoked",
    "missing_session",
  ])("borra la sesión PERSISTIDA cuando el server dice %s", async (reason) => {
    // Un token que el servidor rechazó no debe sobrevivir en disco: si lo
    // hiciera, la próxima apertura de la app lo volvería a presentar y el
    // jugador comería un 401 antes de cada save.
    const { fetchImpl } = serverStub([
      { status: 401, body: { status: "invalid", reason } },
      { status: 200, body: SAVED },
    ]);
    await postScoreSave(baseInput(stubSigner()), fetchImpl, NOW);

    const stored = localStorage.getItem("chesscito:score-write-session:v1");
    // Quedó el token NUEVO (el de la re-autorización), nunca el rechazado.
    expect(stored).not.toBeNull();
    expect(JSON.parse(stored!).token).toBe(TOKEN_2);
  });

  it("un presupuesto agotado NO borra la sesión ni re-firma", async () => {
    // `session_exhausted` no significa "tu token es inválido": significa que
    // ya gastaste los 25 saves. Re-firmar no recarga el presupuesto, así que
    // pedir una firma sería ruido puro camino al mismo 409.
    const { fetchImpl } = serverStub([
      { status: 409, body: { status: "invalid", reason: "session_exhausted" } },
    ]);
    const signer = stubSigner();
    await postScoreSave(baseInput(signer), fetchImpl, NOW);

    expect(signer).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem("chesscito:score-write-session:v1")).not.toBeNull();
  });

  it("retries only ONCE — never loops on prompts", async () => {
    const { fetchImpl, calls } = serverStub([
      { status: 401, body: { status: "invalid", reason: "session_expired" } },
      { status: 401, body: { status: "invalid", reason: "session_expired" } },
      { status: 200, body: SAVED },
    ]);
    const signer = stubSigner();

    const r = await postScoreSave(baseInput(signer), fetchImpl, NOW);

    expect(r).toMatchObject({ status: "invalid", reason: "session_expired" });
    expect(signer).toHaveBeenCalledTimes(2);
    expect(calls.filter((c) => c.url === "/api/scores/save")).toHaveLength(2);
  });

  it.each([
    ["score_out_of_range", 400],
    ["invalid_level", 400],
    ["session_exhausted", 409],
  ])("does NOT re-prompt on %s", async (reason, status) => {
    // Re-signing does not make an out-of-range score valid, and it does not
    // refill a spent budget. Prompting would be pure noise on the way to the
    // same rejection.
    const { fetchImpl } = serverStub([{ status, body: { status: "invalid", reason } }]);
    const signer = stubSigner();

    const r = await postScoreSave(baseInput(signer), fetchImpl, NOW);

    expect(r).toMatchObject({ reason });
    expect(signer).toHaveBeenCalledTimes(1);
  });

  it("reports a rejected signature instead of pretending it saved", async () => {
    const { fetchImpl, calls } = serverStub([]);
    const r = await postScoreSave(
      { ...baseInput(stubSigner()), signMessage: vi.fn().mockRejectedValue(new Error("User rejected")) },
      fetchImpl,
      NOW,
    );
    expect(r).toEqual({ status: "error", reason: "signature_rejected" });
    expect(calls.some((c) => c.url === "/api/scores/save")).toBe(false);
  });

  it("degrades a thrown fetch to a controlled error (no throw, no silent saved)", async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error("network down"));
    const r = await postScoreSave(baseInput(stubSigner()), fetchImpl as never, NOW);
    expect(r.status).toBe("error");
  });
});

describe("postScoreSave — status mapping", () => {
  beforeEach(() => clearScoreSession());
  afterEach(() => clearScoreSession());

  it.each([
    ["200 duplicate", 200, { status: "duplicate", quota: QUOTA }, "duplicate"],
    ["429 rate_limited", 429, { status: "rate_limited", retryAfterMs: 60000 }, "rate_limited"],
    ["400 invalid", 400, { status: "invalid", reason: "invalid_score" }, "invalid"],
    ["500 error", 500, { status: "error", reason: "save_failed" }, "error"],
    ["503 unavailable", 503, { status: "error", reason: "unavailable" }, "error"],
  ])("maps %s", async (_label, status, body, expected) => {
    const { fetchImpl } = serverStub([{ status, body }]);
    const r = await postScoreSave(baseInput(stubSigner()), fetchImpl, NOW);
    expect(r.status).toBe(expected);
  });

  it("degrades an unparseable body to a controlled error", async () => {
    const fetchImpl = vi.fn(async (url: string) => {
      if (url === "/api/scores/session/challenge") {
        return jsonResponse(200, { message: "x" });
      }
      return { ok: true, status: 200, json: async () => { throw new Error("nope"); } } as unknown as Response;
    }) as unknown as typeof fetch;
    const r = await postScoreSave(baseInput(stubSigner()), fetchImpl, NOW);
    expect(r.status).toBe("error");
  });

  it("rejects an unknown status payload as a controlled error", async () => {
    const { fetchImpl } = serverStub([{ status: 200, body: { status: "weird_unknown" } }]);
    const r = await postScoreSave(baseInput(stubSigner()), fetchImpl, NOW);
    expect(r.status).toBe("error");
  });
});

describe("postScoreSave — off-chain isolation guard", () => {
  it("imports NO contract / signing machinery", () => {
    const src = readFileSync(
      join(process.cwd(), "src", "lib", "scores", "save-client.ts"),
      "utf-8",
    );
    // Strip comments — prose may NAME the retained on-chain lane; what must
    // never appear is an import/use of it.
    const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
    expect(code).not.toMatch(/["'`][^"'`]*\/api\/sign-score/);
    expect(code).not.toMatch(/submitScoreSigned/);
    expect(code).not.toMatch(/scoreboardAbi|getScoreboardAddress|ScoreboardAddress/);
    expect(code).not.toMatch(/from\s+["'](wagmi|viem)["']/);
    expect(code).not.toMatch(/useWriteContract|writeContract/);
  });
});
