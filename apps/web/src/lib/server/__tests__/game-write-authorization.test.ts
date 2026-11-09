import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { buildGameWriteMessage, GAME_WRITE_ISSUED_HEADER, GAME_WRITE_SIGNATURE_HEADER, GAME_WRITE_TTL_MS } from "@/lib/coach/game-write-message";
import { buildHistoryReadMessage } from "@/lib/coach/history-read-message";
import { authorizeGameWrite } from "../game-write-authorization";

const owner = privateKeyToAccount(generatePrivateKey());
const other = privateKeyToAccount(generatePrivateKey());
const origin = "https://play.example.test";
const gameId = "550e8400-e29b-41d4-a716-446655440000";
const now = 1_800_000_000_000;
const gamePayload = { walletAddress: owner.address, game: {
  gameId, moves: ["e4", "e5"], result: "win", difficulty: "easy", totalMoves: 2, elapsedMs: 1000, timestamp: now,
} };
const receiptPayload = {
  wallet: owner.address, tokenId: "42", claimTxHash: `0x${"ab".repeat(32)}`,
  shareCardUrl: `${origin}/og/42`, shareLinkUrl: `${origin}/v/42`,
};
async function proof(path = "/api/games", body = JSON.stringify(gamePayload), issuedAt = now) {
  return {
    [GAME_WRITE_ISSUED_HEADER]: String(issuedAt),
    [GAME_WRITE_SIGNATURE_HEADER]: await owner.signMessage({ message: buildGameWriteMessage({
      origin, path, wallet: owner.address, gameId, body, issuedAt,
    }) }),
  };
}
describe("game write proof", () => {
  it("accepts the owner and exact signed body", async () => {
    const body = JSON.stringify(gamePayload);
    const req = new Request(`${origin}/api/games`, { method: "POST", headers: await proof() });
    expect(await authorizeGameWrite(req, owner.address.toLowerCase(), gameId, body, now)).toBe(true);
  });
  it("rejects another wallet, altered content, or another game", async () => {
    const body = JSON.stringify(gamePayload);
    const req = new Request(`${origin}/api/games`, { method: "POST", headers: await proof() });
    expect(await authorizeGameWrite(req, other.address, gameId, body, now)).toBe(false);
    expect(await authorizeGameWrite(req, owner.address, gameId, body.replace('"win"', '"draw"'), now)).toBe(false);
    expect(await authorizeGameWrite(req, owner.address, "650e8400-e29b-41d4-a716-446655440000", body, now)).toBe(false);
  });
  it("rejects another origin, resource or method", async () => {
    const headers = await proof();
    const body = JSON.stringify(gamePayload);
    for (const req of [
      new Request(`https://learn.example.test/api/games`, { method: "POST", headers }),
      new Request(`${origin}/api/games/${gameId}/mint-receipt`, { method: "POST", headers }),
      new Request(`${origin}/api/peones/spend`, { method: "POST", headers }),
      new Request(`${origin}/api/games`, { headers }),
    ]) expect(await authorizeGameWrite(req, owner.address, gameId, body, now)).toBe(false);
  });
  it("does not upgrade a read-only signature to a write permission", async () => {
    const headers = await proof();
    headers[GAME_WRITE_SIGNATURE_HEADER] = await owner.signMessage({ message: buildHistoryReadMessage(origin, owner.address, now) });
    const req = new Request(`${origin}/api/games`, { method: "POST", headers });
    expect(await authorizeGameWrite(req, owner.address, gameId, JSON.stringify(gamePayload), now)).toBe(false);
  });
  it("rejects missing, expired and future proofs", async () => {
    const body = JSON.stringify(gamePayload);
    for (const headers of [{}, await proof("/api/games", body, now - GAME_WRITE_TTL_MS), await proof("/api/games", body, now + 30_001)]) {
      expect(await authorizeGameWrite(new Request(`${origin}/api/games`, { method: "POST", headers }), owner.address, gameId, body, now)).toBe(false);
    }
  });
});

const storage = vi.hoisted(() => ({ get: vi.fn(), set: vi.fn(), eval: vi.fn() }));
vi.mock("@/lib/server/redis", () => ({ getRedis: () => storage }));
vi.mock("@/lib/server/demo-signing", () => ({ enforceOrigin: vi.fn(), enforceRateLimit: vi.fn(), getRequestIp: () => "test" }));
vi.mock("@/lib/server/logger", () => ({ createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }), hashWallet: () => "test" }));
vi.mock("@/lib/coach/game-persistence", async (original) => ({
  ...await original<typeof import("@/lib/coach/game-persistence")>(), enforceGameCap: vi.fn(),
}));
import { POST as save } from "@/app/api/games/route";
import { POST as receipt } from "@/app/api/games/[id]/mint-receipt/route";
const endpoints = [
  { path: "/api/games", payload: gamePayload, write: save },
  { path: `/api/games/${gameId}/mint-receipt`, payload: receiptPayload, write: (req: Request) => receipt(req, { params: Promise.resolve({ id: gameId }) }) },
];
describe.each(endpoints)("ownership before storage $path", ({ path, payload, write }) => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("NEXT_PUBLIC_APP_URL", origin);
    vi.stubGlobal("fetch", vi.fn(() => { throw new Error("Network disabled in write authorization tests"); }));
    storage.get.mockResolvedValue({ ...gamePayload.game });
    storage.set.mockResolvedValue("OK");
    storage.eval.mockResolvedValue(1);
  });
  afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
  it("denies unsigned writes before reading or changing game data", async () => {
    const res = await write(new Request(`${origin}${path}`, { method: "POST", body: JSON.stringify(payload) }));
    expect(res.status).toBe(401);
    expect(storage.get).not.toHaveBeenCalled();
    expect(storage.set).not.toHaveBeenCalled();
    expect(storage.eval).not.toHaveBeenCalled();
  });
  it("denies a valid signature used to overwrite another wallet's record", async () => {
    const body = JSON.stringify(payload);
    const headers = await proof(path, body, Date.now());
    const changed = path === "/api/games" ? { ...payload, walletAddress: other.address } : { ...payload, wallet: other.address };
    const res = await write(new Request(`${origin}${path}`, { method: "POST", headers, body: JSON.stringify(changed) }));
    expect(res.status).toBe(401);
    expect(storage.get).not.toHaveBeenCalled();
    expect(storage.set).not.toHaveBeenCalled();
    expect(storage.eval).not.toHaveBeenCalled();
  });
  it("saves a valid owner request only under that owner's key", async () => {
    const body = JSON.stringify(payload);
    const res = await write(new Request(`${origin}${path}`, { method: "POST", headers: await proof(path, body, Date.now()), body }));
    expect(res.status).toBe(200);
    expect(storage.set).toHaveBeenCalledWith(`coach:game:${owner.address.toLowerCase()}:${gameId}`, expect.any(Object), expect.any(Object));
  });
});
