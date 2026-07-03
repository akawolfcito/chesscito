import { describe, expect, it, vi, afterEach } from "vitest";

import { isVictoryPermitMintEnabled } from "../feature-flags";

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

describe("isVictoryPermitMintEnabled", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("is false when the env var is unset", () => {
    vi.stubEnv("NEXT_PUBLIC_VICTORY_PERMIT_MINT_ENABLED", "");
    expect(isVictoryPermitMintEnabled()).toBe(false);
  });

  it("is true only when the env var is exactly \"true\"", () => {
    vi.stubEnv("NEXT_PUBLIC_VICTORY_PERMIT_MINT_ENABLED", "true");
    expect(isVictoryPermitMintEnabled()).toBe(true);
  });
});
