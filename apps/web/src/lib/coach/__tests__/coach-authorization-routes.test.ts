import { beforeEach, describe, expect, it, vi } from "vitest";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

const redis = vi.hoisted(() => ({ get: vi.fn(), set: vi.fn(), eval: vi.fn() }));
vi.mock("@/lib/server/redis", () => ({ getRedis: () => redis }));
vi.mock("@/lib/server/demo-signing", () => ({
  enforceOrigin: () => {}, enforceRateLimit: async () => {}, getRequestIp: () => "qa",
}));
// Never initialize a real provider or external database in this integration QA.
vi.mock("openai", () => ({ default: class {} }));
vi.mock("@/lib/supabase/server", () => ({ getSupabaseServer: () => { throw new Error("QA database forbidden"); } }));
vi.mock("@/lib/coach/availability", () => ({ COACH_AI_ENABLED: true }));
import { POST } from "@/app/api/coach/analyze/route";
import { GET } from "@/app/api/coach/job/[id]/route";
import { buildCoachRequestMessage, coachPayloadHash, COACH_REQUEST_HEADERS as H } from "../coach-request-message";

const account = privateKeyToAccount(generatePrivateKey());
const gameId = crypto.randomUUID();
const jobId = crypto.randomUUID();
const origin = "https://qa.invalid";
async function signed(body: string) {
  const issuedAt = Date.now();
  const nonce = crypto.randomUUID();
  const payloadHash = coachPayloadHash(body);
  const signature = await account.signMessage({ message: buildCoachRequestMessage({
    origin, wallet: account.address, gameId, payloadHash, nonce, issuedAt,
  }) });
  return { [H.issued]: String(issuedAt), [H.nonce]: nonce, [H.signature]: signature, [H.payload]: payloadHash, [H.game]: gameId };
}
const postRequest = (body: string, headers: Record<string, string>) =>
  new Request(`${origin}/api/coach/analyze`, { method: "POST", body, headers });
const pollRequest = (headers: Record<string, string>) =>
  new Request(`${origin}/api/coach/job/${jobId}?wallet=${account.address}`, { headers });
const body = () => JSON.stringify({ walletAddress: account.address, gameId });

beforeEach(() => { redis.get.mockReset(); redis.set.mockReset(); redis.eval.mockReset(); });

describe("real Coach signature verification integrated with routes", () => {
  it("rejects unsigned writes while permitting public job lookup", async () => {
    expect((await POST(postRequest(body(), {}))).status).toBe(401);
    expect(redis.get).not.toHaveBeenCalled();
    expect((await GET(pollRequest({}), { params: { id: jobId } })).status).toBe(404);
    expect(redis.get).toHaveBeenCalledTimes(1); expect(redis.set).not.toHaveBeenCalled(); expect(redis.eval).not.toHaveBeenCalled();
  });
  it("permits an owner's cache read once and rejects concurrent replay before another read", async () => {
    const claimed = new Set<string>();
    redis.set.mockImplementation(async (key: string) => {
      if (claimed.has(key)) return null;
      claimed.add(key); return "OK";
    });
    redis.get.mockResolvedValue({ response: { summary: "QA cached analysis" }, locale: "en" });
    const rawBody = body();
    const headers = await signed(rawBody);
    const responses = await Promise.all([
      POST(postRequest(rawBody, headers)), POST(postRequest(rawBody, headers)),
    ]);
    expect(responses.map((res) => res.status).sort()).toEqual([200, 409]);
    expect(redis.get).toHaveBeenCalledTimes(1);
    expect(redis.eval).not.toHaveBeenCalled();
    const ok = responses.find((res) => res.status === 200)!;
    expect(ok.headers.get("cache-control")).toBe("no-store");
  });
  it("rejects changed analysis flags before cache access or proof consumption", async () => {
    const headers = await signed(body());
    const changed = JSON.stringify({ walletAddress: account.address, gameId, forceLocale: true });
    expect((await POST(postRequest(changed, headers))).status).toBe(401);
    expect(redis.get).not.toHaveBeenCalled(); expect(redis.set).not.toHaveBeenCalled();
  });
  it("reads an owned completed job but rejects legacy, malformed-game and foreign-wallet records", async () => {
    const headers = await signed(body());
    redis.get.mockResolvedValue({ status: "ready", wallet: account.address.toLowerCase(), gameId, response: { summary: "QA private" }, internal: "qa-internal" });
    const res = await GET(pollRequest(headers), { params: { id: jobId } });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "ready", response: { summary: "QA private" } });
    for (const record of [
      { status: "ready", response: { summary: "legacy" } },
      { status: "pending", wallet: account.address, gameId: "invalid" },
      { status: "pending", wallet: privateKeyToAccount(generatePrivateKey()).address, gameId },
    ]) {
      redis.get.mockResolvedValue(record);
      expect((await GET(pollRequest(headers), { params: { id: jobId } })).status).toBe(403);
    }
  });
});
