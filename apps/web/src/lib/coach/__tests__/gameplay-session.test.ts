import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearScoreSession } from "@/lib/scores/session-client";
import { postSignedGameWrite } from "../signed-game-write";
import { postAuthorizedCoachAnalyze } from "../coach-request-access";
import { authorizeGameplaySession } from "@/lib/server/gameplay-session";
import { authorizeCoachRequest } from "@/lib/server/coach-request-authorization";
import { authorizeGameWrite } from "@/lib/server/game-write-authorization";

const fixture = vi.hoisted(() => ({ row: null as Record<string, unknown> | null }));
const getServer = vi.hoisted(() => vi.fn());
vi.mock("@/lib/supabase/server", () => ({ getSupabaseServer: getServer }));
const wallet = `0x${"1".repeat(40)}` as `0x${string}`;
const token = "a".repeat(64);
const gameId = "550e8400-e29b-41d4-a716-446655440000";
const request = () => new Request("https://qa.invalid/api/games", { headers: { Authorization: `Bearer ${token}` } });
beforeEach(() => {
  clearScoreSession();
  vi.stubEnv("NEXT_PUBLIC_CHESSCITO_MODE", "play");
  fixture.row = { wallet, surface: "play", authorized_at: new Date().toISOString(), revoked_at: null, expires_at: new Date(Date.now() + 86400_000).toISOString() };
  const query = { select: () => query, eq: () => query, maybeSingle: async () => ({ data: fixture.row, error: null }) };
  getServer.mockReturnValue({ from: () => query });
});
afterEach(() => { clearScoreSession(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
describe("shared daily gameplay authorization", () => {
  it("reuses one signature across multiple game saves and Coach requests", async () => {
    const signMessage = vi.fn(async () => `0x${"ab".repeat(65)}` as `0x${string}`);
    const fetchMock = vi.fn<typeof fetch>(async (input, init) => {
      if (input === "/api/scores/session/challenge") return Response.json({ message: "Test session", expiresAt: Math.floor(Date.now()/1000) + 86400, maxSaves: 100 });
      if (input === "/api/scores/session/authorize") return Response.json({ token, expiresAt: Math.floor(Date.now()/1000) + 86400, maxSaves: 100 });
      const req = new Request(`https://qa.invalid${input}`, init);
      if (input === "/api/games") expect(await authorizeGameWrite(req, wallet, gameId, String(init?.body))).toBe(true);
      else expect((await authorizeCoachRequest(req, wallet, String(init?.body)))?.gameId).toBe(gameId);
      return Response.json({ ok: true });
    });
    vi.stubGlobal("fetch", fetchMock);
    const deps = { origin: "https://qa.invalid", wallet, isCurrent: () => true, signMessage };
    for (let i = 0; i < 2; i++) await postSignedGameWrite({ path: "/api/games", wallet, gameId, payload: { gameId } }, deps);
    await postAuthorizedCoachAnalyze("/api/coach/analyze", { method: "POST", body: JSON.stringify({ walletAddress: wallet, gameId }) }, deps);
    expect(signMessage).toHaveBeenCalledTimes(1);
    expect(getServer).toHaveBeenCalledWith({ freshReads: true });
    expect(fetchMock.mock.calls.filter(([url]) => url === "/api/scores/session/challenge")).toHaveLength(1);
  });
  it("clears a rejected session without opening another signature prompt automatically", async () => {
    const signMessage = vi.fn(async () => `0x${"ab".repeat(65)}` as `0x${string}`);
    vi.stubGlobal("fetch", vi.fn(async (input) => {
      if (input === "/api/scores/session/challenge") return Response.json({ message: "Test session" });
      if (input === "/api/scores/session/authorize") return Response.json({ token, expiresAt: Math.floor(Date.now()/1000) + 86400, maxSaves: 100 });
      return new Response(null, { status: 401 });
    }));
    const deps = { origin: "https://qa.invalid", isCurrent: () => true, signMessage };
    for (let i = 0; i < 2; i++) {
      expect((await postSignedGameWrite({ path: "/api/games", wallet, gameId, payload: { gameId } }, deps)).status).toBe(401);
      expect(signMessage).toHaveBeenCalledTimes(i + 1);
    }
  });
  it.each(["expired", "revoked", "unsigned", "other_wallet", "other_surface", "missing"])("rejects %s sessions", async (mode) => {
    if (mode === "expired") fixture.row!.expires_at = new Date(Date.now() - 180000).toISOString();
    if (mode === "revoked") fixture.row!.revoked_at = new Date().toISOString();
    if (mode === "unsigned") fixture.row!.authorized_at = null;
    if (mode === "other_wallet") fixture.row!.wallet = `0x${"2".repeat(40)}`;
    if (mode === "other_surface") fixture.row!.surface = "learn";
    if (mode === "missing") fixture.row = null;
    expect(await authorizeGameplaySession(request(), wallet)).toBe(false);
  });
});
