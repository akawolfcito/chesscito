import { describe, it, expect, vi, afterEach } from "vitest";
import { isDevSurfaceEnabled, canWriteBaseline } from "@/lib/dev/dev-surface";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("isDevSurfaceEnabled", () => {
  it("is disabled in production", () => {
    vi.stubEnv("VERCEL_ENV", "production");
    expect(isDevSurfaceEnabled()).toBe(false);
  });

  /** The whole point of the rule. A preview build runs with
   *  NODE_ENV="production", so the old NODE_ENV gate killed the tooling exactly
   *  where the founder wants it alive. */
  it("is ENABLED in preview, where NODE_ENV would say production", () => {
    vi.stubEnv("VERCEL_ENV", "preview");
    vi.stubEnv("NODE_ENV", "production");
    expect(isDevSurfaceEnabled()).toBe(true);
  });

  it("is enabled locally, where VERCEL_ENV is unset", () => {
    vi.stubEnv("VERCEL_ENV", undefined);
    expect(isDevSurfaceEnabled()).toBe(true);
  });
});

describe("canWriteBaseline", () => {
  it("is true locally", () => {
    vi.stubEnv("VERCEL", undefined);
    expect(canWriteBaseline()).toBe(true);
  });

  /** The physical limit the spec names: baseline-write.ts does writeFileSync on
   *  process.cwd(), and Vercel's deployment filesystem is READ-ONLY. Preview can
   *  render the builder and validate a draft; it can never Save. The UI must say
   *  so instead of throwing a 500. */
  it("is FALSE on a preview deploy, even though the surface is enabled there", () => {
    vi.stubEnv("VERCEL", "1");
    vi.stubEnv("VERCEL_ENV", "preview");
    expect(isDevSurfaceEnabled()).toBe(true);
    expect(canWriteBaseline()).toBe(false);
  });
});
