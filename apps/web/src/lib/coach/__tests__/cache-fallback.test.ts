import { describe, it, expect, vi } from "vitest";

import { getCachedAnalysisWithFallback } from "../cache-fallback";
import { REDIS_KEYS } from "../redis-keys";
import type { CoachAnalysisRecord } from "../types";

type AnyRedis = Parameters<typeof getCachedAnalysisWithFallback>[0];

const WALLET = "0x000000000000000000000000000000000000abcd";
const GAME_ID = "11111111-2222-3333-4444-555555555555";

function makeRecord(locale?: "en" | "es"): CoachAnalysisRecord {
  return {
    gameId: GAME_ID,
    provider: "server",
    analysisVersion: "1.0.0",
    createdAt: Date.now(),
    response: {
      kind: "quick",
      summary: "test",
      tips: [],
    },
    ...(locale ? { locale } : {}),
  };
}

function makeRedis(
  store: Map<string, CoachAnalysisRecord>,
): AnyRedis {
  return {
    get: vi
      .fn()
      .mockImplementation(async (key: string) => store.get(key) ?? null),
  } as unknown as AnyRedis;
}

describe("getCachedAnalysisWithFallback", () => {
  it("returns the per-locale record when present", async () => {
    const record = makeRecord("es");
    const store = new Map<string, CoachAnalysisRecord>([
      [REDIS_KEYS.analysis(WALLET, GAME_ID, "es"), record],
    ]);
    const got = await getCachedAnalysisWithFallback(
      makeRedis(store),
      WALLET,
      GAME_ID,
      "es",
    );
    expect(got).toEqual(record);
  });

  it("falls back to the legacy key when EN cache misses", async () => {
    const legacy = makeRecord();
    const store = new Map<string, CoachAnalysisRecord>([
      [REDIS_KEYS.analysisLegacy(WALLET, GAME_ID), legacy],
    ]);
    const got = await getCachedAnalysisWithFallback(
      makeRedis(store),
      WALLET,
      GAME_ID,
      "en",
    );
    expect(got).not.toBeNull();
    expect(got?.locale).toBe("en");
  });

  it("does NOT fall back to the legacy key for ES requests", async () => {
    const legacy = makeRecord();
    const store = new Map<string, CoachAnalysisRecord>([
      [REDIS_KEYS.analysisLegacy(WALLET, GAME_ID), legacy],
    ]);
    const got = await getCachedAnalysisWithFallback(
      makeRedis(store),
      WALLET,
      GAME_ID,
      "es",
    );
    expect(got).toBeNull();
  });

  it("returns null when both keys miss", async () => {
    const got = await getCachedAnalysisWithFallback(
      makeRedis(new Map()),
      WALLET,
      GAME_ID,
      "en",
    );
    expect(got).toBeNull();
  });

  it("normalizes records without a locale field to the requested locale", async () => {
    const legacyWithoutLocale = makeRecord();
    const store = new Map<string, CoachAnalysisRecord>([
      [REDIS_KEYS.analysisLegacy(WALLET, GAME_ID), legacyWithoutLocale],
    ]);
    const got = await getCachedAnalysisWithFallback(
      makeRedis(store),
      WALLET,
      GAME_ID,
      "en",
    );
    expect(got?.locale).toBe("en");
  });
});
