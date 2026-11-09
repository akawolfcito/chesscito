import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { postSignedGameWrite, type GameWriteArgs } from "../signed-game-write";
import { authorizeGameWrite } from "@/lib/server/game-write-authorization";
import { GAME_WRITE_TTL_MS } from "../game-write-message";

const owner = privateKeyToAccount(generatePrivateKey());
const origin = "https://play.example.test";
const gameId = "550e8400-e29b-41d4-a716-446655440000";
const args: GameWriteArgs = { path: "/api/games", wallet: owner.address, gameId, payload: { walletAddress: owner.address, game: { gameId, moves: ["e4"] } } };
const sign = vi.fn(async ({ message }: { message: string }) => owner.signMessage({ message }));
describe("signed game transport", () => {
  beforeEach(() => { vi.clearAllMocks(); vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 200 }))); });
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
  it("posts exactly the signed bytes and produces a proof accepted by the server", async () => {
    await postSignedGameWrite(args, { origin, signMessage: sign, isCurrent: () => true });
    const [path, init] = vi.mocked(fetch).mock.calls[0];
    const req = new Request(`${origin}${path}`, init);
    expect(await authorizeGameWrite(req, owner.address, gameId, String(init?.body))).toBe(true);
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
  it("never posts after cancellation or a signature that took too long", async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(postSignedGameWrite({ ...args, signal: controller.signal }, { origin, signMessage: sign, isCurrent: () => true })).rejects.toThrow("game_write_cancelled");
    expect(sign).not.toHaveBeenCalled();
    vi.useFakeTimers();
    await expect(postSignedGameWrite(args, { origin, isCurrent: () => true, signMessage: async () => {
      vi.advanceTimersByTime(GAME_WRITE_TTL_MS); return owner.signMessage({ message: "fixture" });
    } })).rejects.toThrow("game_write_cancelled");
    expect(fetch).not.toHaveBeenCalled();
  });
});
