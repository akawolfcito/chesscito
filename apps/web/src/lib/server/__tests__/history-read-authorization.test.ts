import { beforeEach, describe, expect, it, vi } from "vitest";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { buildHistoryReadMessage, HISTORY_READ_ISSUED_HEADER, HISTORY_READ_SIGNATURE_HEADER, HISTORY_READ_TTL_MS } from "@/lib/coach/history-read-message";
import { authorizeHistoryRead } from "../history-read-authorization";

// Ephemeral test identities only; never use configured wallets or credentials.
const owner = privateKeyToAccount(generatePrivateKey());
const other = privateKeyToAccount(generatePrivateKey());
const origin = "https://play.example.test";
const now = 1_800_000_000_000;
async function signed(issuedAt = now, signedOrigin = origin, requestedWallet = owner.address) {
  return new Request(`${origin}/api/games?wallet=${requestedWallet}`, { headers: {
    [HISTORY_READ_ISSUED_HEADER]: String(issuedAt),
    [HISTORY_READ_SIGNATURE_HEADER]: await owner.signMessage({
      message: buildHistoryReadMessage(signedOrigin, owner.address, issuedAt),
    }),
  } });
}
describe("private history read proof", () => {
  it("accepts a current owner proof, including normalized wallet casing", async () => {
    expect(await authorizeHistoryRead(await signed(), owner.address.toLowerCase(), now)).toBe(true);
  });
  it("rejects another wallet even with allowed Origin and Referer", async () => {
    const req = await signed();
    req.headers.set("origin", origin);
    req.headers.set("referer", `${origin}/coach/history`);
    expect(await authorizeHistoryRead(req, other.address, now)).toBe(false);
  });
  it("rejects a proof copied to another origin", async () => {
    expect(await authorizeHistoryRead(await signed(now, "https://learn.example.test"), owner.address, now)).toBe(false);
  });
  it("does not accept a signature for another action or altered timestamp", async () => {
    const req = await signed();
    req.headers.set(HISTORY_READ_SIGNATURE_HEADER, await owner.signMessage({ message: "Delete my Coach history" }));
    expect(await authorizeHistoryRead(req, owner.address, now)).toBe(false);
    const altered = await signed();
    altered.headers.set(HISTORY_READ_ISSUED_HEADER, String(now + 1));
    expect(await authorizeHistoryRead(altered, owner.address, now)).toBe(false);
  });
  it("rejects missing, malformed, expired and future proofs", async () => {
    expect(await authorizeHistoryRead(new Request(origin), owner.address, now)).toBe(false);
    const bad = await signed();
    bad.headers.set(HISTORY_READ_SIGNATURE_HEADER, "invalid");
    expect(await authorizeHistoryRead(bad, owner.address, now)).toBe(false);
    expect(await authorizeHistoryRead(await signed(now - HISTORY_READ_TTL_MS), owner.address, now)).toBe(false);
    expect(await authorizeHistoryRead(await signed(now + 30_001), owner.address, now)).toBe(false);
  });
});

const storage = vi.hoisted(() => ({ get: vi.fn(), lrange: vi.fn() }));
vi.mock("@/lib/server/redis", () => ({ getRedis: () => storage }));
vi.mock("@/lib/server/demo-signing", () => ({ enforceOrigin: vi.fn(), enforceRateLimit: vi.fn(), getRequestIp: () => "test" }));
vi.mock("@/lib/server/rate-limit", () => ({ checkRateLimit: async () => ({ allowed: true }) }));
vi.mock("@/lib/supabase/server", () => ({ getSupabaseServer: () => null }));
vi.mock("@/lib/server/logger", () => ({ createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }), hashWallet: () => "test" }));
vi.mock("@/lib/server/redis-observability", () => ({ recordRedisUsage: vi.fn() }));

import { GET as history } from "@/app/api/coach/history/route";
import { GET as games } from "@/app/api/games/route";
import { GET as game } from "@/app/api/games/[id]/route";
const gameId = "550e8400-e29b-41d4-a716-446655440000";
const routes = [
  { path: "/api/coach/history", read: history },
  { path: "/api/games", read: games },
  { path: `/api/games/${gameId}`, read: (req: Request) => game(req, { params: Promise.resolve({ id: gameId }) }) },
];
describe.each(routes)("public history $path", ({ path, read }) => {
  beforeEach(() => {
    vi.clearAllMocks();
    storage.lrange.mockResolvedValue([]);
    storage.get.mockResolvedValue({ gameId, moves: [], analysis: { response: { summary: "fixture" } } });
    vi.stubGlobal("fetch", vi.fn(() => { throw new Error("Network disabled in ownership tests"); }));
  });
  it("reads saved records without a proof, including without Origin", async () => {
    const response = await read(new Request(`${origin}${path}?wallet=${owner.address}`));
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(storage.get.mock.calls.length + storage.lrange.mock.calls.length).toBeGreaterThan(0);
  });
  it("uses the public query wallet independently of obsolete proof headers", async () => {
    const proof = await signed();
    const response = await read(new Request(`${origin}${path}?wallet=${other.address}`, { headers: proof.headers }));
    expect(response.status).toBe(200);
    expect(storage.get.mock.calls.length + storage.lrange.mock.calls.length).toBeGreaterThan(0);
  });
  it("allows owner reads and disables response caching", async () => {
    const issuedAt = Date.now();
    const proof = await signed(issuedAt);
    const response = await read(new Request(`${origin}${path}?wallet=${owner.address}`, { headers: proof.headers }));
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
  });
});
