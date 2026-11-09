import { afterEach, describe, expect, it, vi } from "vitest";

type EnvValue = string | undefined;

async function importFlags(mode: EnvValue, legacy: EnvValue) {
  vi.resetModules();

  if (mode === undefined) {
    vi.stubEnv("NEXT_PUBLIC_CHESSCITO_MODE", undefined);
  } else {
    vi.stubEnv("NEXT_PUBLIC_CHESSCITO_MODE", mode);
  }

  if (legacy === undefined) {
    vi.stubEnv("NEXT_PUBLIC_CHESSCITO_LITE_MODE", undefined);
  } else {
    vi.stubEnv("NEXT_PUBLIC_CHESSCITO_LITE_MODE", legacy);
  }

  return import("@/lib/feature-flags");
}

describe("Chesscito deployment mode", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it.each([
    [undefined, undefined, "full"],
    [undefined, "false", "full"],
    [undefined, "true", "learn"],
    ["", "", "full"],
    ["full", undefined, "full"],
    ["full", "false", "full"],
    ["learn", undefined, "learn"],
    ["learn", "true", "learn"],
    ["play", undefined, "play"],
    ["play", "false", "play"],
  ] as const)(
    "resolves new=%s legacy=%s as %s",
    async (mode, legacy, expected) => {
      const flags = await importFlags(mode, legacy);

      expect(flags.CHESSCITO_MODE).toBe(expected);
      expect(flags.isFullMode()).toBe(expected === "full");
      expect(flags.isLearnMode()).toBe(expected === "learn");
      expect(flags.isPlayMode()).toBe(expected === "play");
      expect(flags.CHESSCITO_LITE_MODE).toBe(expected === "learn");
      expect(flags.isLiteModeServer()).toBe(expected === "learn");
    },
  );

  it.each(["lite", "training", "FULL", "true"])(
    "rejects invalid new mode %s",
    async (mode) => {
      await expect(importFlags(mode, undefined)).rejects.toThrow(
        "Invalid NEXT_PUBLIC_CHESSCITO_MODE",
      );
    },
  );

  it.each([
    ["learn", "false"],
    ["full", "true"],
    ["play", "true"],
  ] as const)(
    "rejects contradictory new=%s legacy=%s",
    async (mode, legacy) => {
      await expect(importFlags(mode, legacy)).rejects.toThrow(
        "Contradictory Chesscito mode flags",
      );
    },
  );

  it("keeps the server alias call-time compatible", async () => {
    const flags = await importFlags(undefined, "false");
    expect(flags.isLiteModeServer()).toBe(false);

    vi.stubEnv("NEXT_PUBLIC_CHESSCITO_LITE_MODE", "true");
    expect(flags.isLiteModeServer()).toBe(true);
  });
});

describe("isVictoryPermitMintEnabled", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("is false when the env var is unset", async () => {
    vi.stubEnv("NEXT_PUBLIC_VICTORY_PERMIT_MINT_ENABLED", "");
    const { isVictoryPermitMintEnabled } = await import("../feature-flags");
    expect(isVictoryPermitMintEnabled()).toBe(false);
  });

  it("is true only when the env var is exactly true", async () => {
    vi.stubEnv("NEXT_PUBLIC_VICTORY_PERMIT_MINT_ENABLED", "true");
    const { isVictoryPermitMintEnabled } = await import("../feature-flags");
    expect(isVictoryPermitMintEnabled()).toBe(true);
  });
});
