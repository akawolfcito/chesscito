import { describe, expect, it } from "vitest";
import { POST } from "../route";

describe("paused PRO verification", () => {
  it.each([{}, { txHash: `0x${"a".repeat(64)}`, walletAddress: `0x${"b".repeat(40)}` }])(
    "refuses verification without granting or extending access", async (body) => {
      const response = await POST(new Request("https://example.com/api/verify-pro", { method: "POST", body: JSON.stringify(body) }));
      expect(response.status).toBe(403);
      expect(await response.json()).toEqual({ error: "pro_sales_paused" });
    },
  );
});
