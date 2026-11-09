import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { postSignedGameWrite, type GameWriteArgs } from "../signed-game-write";
vi.mock("@/lib/scores/session-client", () => ({ ensureScoreSession: async ({ signMessage }: { signMessage: (args: { message: string }) => Promise<unknown> }) => {
  try { await signMessage({ message: "Test game session" }); return { ok: true, session: { token: "a".repeat(64) } }; }
  catch { return { ok: false }; }
} }));
const owner = privateKeyToAccount(generatePrivateKey());
const origin = "https://play.example.test";
const gameId = "550e8400-e29b-41d4-a716-446655440000";
const args: GameWriteArgs = { path: "/api/games", wallet: owner.address, gameId, payload: { walletAddress: owner.address, game: { gameId, moves: ["e4"] } } };
const sign = vi.fn(async ({ message }: { message: string }) => owner.signMessage({ message }));
describe("signed game transport", () => {
  beforeEach(() => { vi.clearAllMocks(); vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 200 }))); });
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
  it("posts the game using the issued wallet session", async () => {
    await postSignedGameWrite(args, { origin, signMessage: sign, isCurrent: () => true });
    const [path, init] = vi.mocked(fetch).mock.calls[0];
    const req = new Request(`${origin}${path}`, init);
    expect(req.headers.get("authorization")).toBe(`Bearer ${"a".repeat(64)}`);
    expect(JSON.parse(String(init?.body))).toEqual(args.payload);
    expect(init?.cache).toBe("no-store");
    expect(sign).toHaveBeenCalledTimes(1);
    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(0);
  });
  it("never posts after rejection and reports only a fixed error code", async () => {
    await expect(postSignedGameWrite(args, { origin, signMessage: async () => { throw new Error("provider details must not escape"); }, isCurrent: () => true })).rejects.toThrow("game_write_confirmation_failed");
    expect(fetch).not.toHaveBeenCalled();
  });
  it("never posts if wallet identity changes during confirmation", async () => {
    let current = true;
    await expect(postSignedGameWrite(args, { origin, isCurrent: () => current, signMessage: async () => {
      current = false; return owner.signMessage({ message: "fixture" });
    } })).rejects.toThrow("game_write_cancelled");
    expect(fetch).not.toHaveBeenCalled();
  });
  it("never posts after cancellation", async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(postSignedGameWrite({ ...args, signal: controller.signal }, { origin, signMessage: sign, isCurrent: () => true })).rejects.toThrow("game_write_cancelled");
    expect(sign).not.toHaveBeenCalled();
  });
});
