import { describe, expect, it, vi } from "vitest";
import { extendProExpiry, PRO_DURATION_MS } from "@/lib/coach/pro-extend";

function fakeRedis(evalImpl: (script: string, keys: string[], args: unknown[]) => Promise<unknown>) {
  return { eval: vi.fn(evalImpl) } as unknown as import("@upstash/redis").Redis;
}

describe("extendProExpiry", () => {
  it("passes the shared Lua script, the key, and [now, PRO_DURATION_MS] as args", async () => {
    let capturedScript = "";
    let capturedKeys: string[] = [];
    let capturedArgs: unknown[] = [];
    const redis = fakeRedis(async (script, keys, args) => {
      capturedScript = script;
      capturedKeys = keys;
      capturedArgs = args;
      return "1234567890000";
    });

    const result = await extendProExpiry(redis, "coach:pro:0xabc");

    expect(capturedKeys).toEqual(["coach:pro:0xabc"]);
    expect(capturedScript).toContain("redis.call('GET', KEYS[1])");
    expect(capturedScript).toContain("redis.call('SET', KEYS[1]");
    expect(typeof capturedArgs[0]).toBe("number"); // now
    expect(capturedArgs[1]).toBe(PRO_DURATION_MS);
    expect(result).toBe(1234567890000);
  });

  it("returns a number even when the Lua script returns a numeric string", async () => {
    const redis = fakeRedis(async () => "42");
    expect(await extendProExpiry(redis, "coach:pro:0xdef")).toBe(42);
  });
});
