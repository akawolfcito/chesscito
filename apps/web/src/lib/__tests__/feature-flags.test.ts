import { describe, expect, it, vi, afterEach } from "vitest";

describe("CHESSCITO_LITE_MODE", () => {
  afterEach(() => {
    vi.resetModules();
  });

  it("is false when env var is absent", async () => {
    vi.stubEnv("NEXT_PUBLIC_CHESSCITO_LITE_MODE", "");
    const { CHESSCITO_LITE_MODE } = await import("@/lib/feature-flags");
    expect(CHESSCITO_LITE_MODE).toBe(false);
  });

  it("is false when env var is 'false'", async () => {
    vi.stubEnv("NEXT_PUBLIC_CHESSCITO_LITE_MODE", "false");
    const { CHESSCITO_LITE_MODE } = await import("@/lib/feature-flags");
    expect(CHESSCITO_LITE_MODE).toBe(false);
  });

  it("is true when env var is 'true'", async () => {
    vi.stubEnv("NEXT_PUBLIC_CHESSCITO_LITE_MODE", "true");
    const { CHESSCITO_LITE_MODE } = await import("@/lib/feature-flags");
    expect(CHESSCITO_LITE_MODE).toBe(true);
  });
});
