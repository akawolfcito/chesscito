import { describe, expect, it, vi } from "vitest";

const redirect = vi.hoisted(() => vi.fn(() => { throw new Error("redirect"); }));
vi.mock("next/navigation", () => ({ redirect }));

import StatsRoute from "../page";

describe("web /stats containment redirect", () => {
  it("redirects /en/stats to the sole durable landing snapshot", async () => {
    await expect(StatsRoute({ params: { locale: "en" } })).rejects.toThrow("redirect");
    expect(redirect).toHaveBeenCalledWith("https://www.chesscito.com/stats");
  });

  it("redirects /es/stats while preserving its route locale", async () => {
    await expect(StatsRoute({ params: { locale: "es" } })).rejects.toThrow("redirect");
    expect(redirect).toHaveBeenLastCalledWith("https://www.chesscito.com/stats?locale=es");
  });
});
