import { beforeEach, describe, expect, it, vi } from "vitest";

import { classifyEarlyAccessOrigin } from "@/lib/server/early-access-origin";

const APP = "https://learn.chesscito.com";

beforeEach(() => {
  vi.unstubAllEnvs();
  vi.stubEnv("NEXT_PUBLIC_APP_URL", APP);
  vi.stubEnv("NEXT_PUBLIC_PREVIEW_URL", "");
  vi.stubEnv("VERCEL_URL", "");
  vi.stubEnv("VERCEL_BRANCH_URL", "");
  vi.stubEnv("VERCEL_PROJECT_PRODUCTION_URL", "");
});

describe("classifyEarlyAccessOrigin", () => {
  it("allows a matching Origin", () => {
    expect(classifyEarlyAccessOrigin(APP, null)).toEqual({
      verdict: "allowed",
      reason: "matched",
    });
  });

  it("falls back to Referer when Origin is absent", () => {
    expect(classifyEarlyAccessOrigin(null, `${APP}/en/hub`)).toEqual({
      verdict: "allowed",
      reason: "matched",
    });
  });

  it("rejects a mismatched host", () => {
    expect(classifyEarlyAccessOrigin("https://evil.example", null)).toEqual({
      verdict: "rejected",
      reason: "mismatch",
    });
  });

  it("rejects a source it cannot even parse", () => {
    // Not more trustworthy than one that parses to the wrong host.
    expect(classifyEarlyAccessOrigin("not a url", null)).toEqual({
      verdict: "rejected",
      reason: "mismatch",
    });
  });

  /** The deliberate divergence from `classifyScoreSaveOrigin`, which ALLOWS
   *  this case for MiniPay's WebView. MiniPay cannot reach this route (the
   *  intake lives in the Privy branch only) and there is no signature to fall
   *  back on, so a header-less caller has nothing legitimate to be. */
  it("rejects a request carrying neither header — stricter than the score route", () => {
    expect(classifyEarlyAccessOrigin(null, null)).toEqual({
      verdict: "rejected",
      reason: "absent",
    });
  });

  it("allows everything when no allow-list is configured (local dev)", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "");

    expect(classifyEarlyAccessOrigin("http://localhost:3002", null)).toEqual({
      verdict: "allowed",
      reason: "unconfigured",
    });
  });

  it("still rejects a header-less caller when unconfigured", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "");

    expect(classifyEarlyAccessOrigin(null, null)).toEqual({
      verdict: "rejected",
      reason: "absent",
    });
  });
});
