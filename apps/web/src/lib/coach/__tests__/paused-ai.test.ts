import { describe, expect, it, vi } from "vitest";
vi.mock("@/lib/server/redis", () => ({ getRedis: () => null }));
vi.mock("@/lib/server/demo-signing", () => ({ enforceOrigin: () => {}, getRequestIp: () => "qa" }));
vi.mock("@/lib/server/rate-limit", () => ({ enforceReadRateLimit: async () => {} }));
const database = vi.hoisted(() => vi.fn());
vi.mock("@/lib/supabase/server", () => ({ getSupabaseServer: database }));
import { POST as analyze } from "@/app/api/coach/analyze/route";
import { POST as spend } from "@/app/api/peones/spend/route";
describe("paused AI server enforcement", () => {
  it("rejects new analyses before storage or provider work", async () => {
    const response = await analyze(new Request("https://qa.invalid/api/coach/analyze", { method: "POST", body: "{}" }));
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "coach_paused" });
    expect(database).not.toHaveBeenCalled();
  });
  it("rejects Coach spending before opening the ledger", async () => {
    const response = await spend(new Request("https://qa.invalid/api/peones/spend", { method: "POST", body: JSON.stringify({ target: "coach" }) }));
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "coach_paused" });
    expect(database).not.toHaveBeenCalled();
  });
});
