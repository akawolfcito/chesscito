import { describe, expect, it } from "vitest";

import {
  CLAIM_ERROR_MAX_LEN,
  describeClaimError,
  truncateClaimError,
} from "../claim-telemetry";

describe("describeClaimError", () => {
  // The first capture (2026-07-21 06:10) truncated to
  //   "An unknown RPC error occurred.\n\nRequest Arguments:\n  chain: ... data: 0xb31e32cc…"
  // and told us nothing: viem puts the request arguments FIRST and the actual
  // provider message LAST, under "Details:". Clipping the head keeps the
  // filler and drops the answer. Prefer the fields viem parsed out for us.
  it("prefers the provider detail over the argument dump", () => {
    const err = Object.assign(new Error("An unknown RPC error occurred.\n\nRequest Arguments:\n  chain: undefined"), {
      shortMessage: "An unknown RPC error occurred.",
      details: "MiniPay: permission denied (code -1)",
    });
    const described = describeClaimError(err);
    expect(described).toContain("MiniPay: permission denied (code -1)");
    expect(described).not.toContain("Request Arguments");
  });

  it("keeps the short message when there is no detail", () => {
    const err = Object.assign(new Error("long\n\nRequest Arguments:\n  chain: x"), {
      shortMessage: "User rejected the request.",
    });
    expect(describeClaimError(err)).toBe("User rejected the request.");
  });

  it("falls back to the plain message for a non-viem error", () => {
    expect(describeClaimError(new Error("boom"))).toBe("boom");
  });

  it("is truncated like any other forwarded message", () => {
    const err = Object.assign(new Error("x"), { details: "y".repeat(9_000) });
    expect(describeClaimError(err)!.length).toBeLessThanOrEqual(CLAIM_ERROR_MAX_LEN);
  });

  it("returns undefined when there is nothing to describe", () => {
    expect(describeClaimError(undefined)).toBeUndefined();
    expect(describeClaimError(null)).toBeUndefined();
  });
});

describe("truncateClaimError", () => {
  // The whole point: `use-mint-victory` emits the raw provider message but
  // `arena/page.tsx` dropped it, so every mint failure landed in Supabase as
  // error_kind "unknown" with no way to tell WHICH unknown.
  // See docs/audits/2026-07-20-payments-rail-gas-regression-diagnosis.md §3.
  it("passes a short provider message through untouched", () => {
    expect(truncateClaimError("execution reverted: MintCooldown")).toBe(
      "execution reverted: MintCooldown",
    );
  });

  // /api/telemetry drops the ENTIRE props object when the serialized payload
  // exceeds 4KB (sanitizeProps → MAX_PROPS_BYTES). A raw viem error carries
  // request bodies and stack frames and blows past that easily, so forwarding
  // it untruncated would lose stage, error_kind and moves too — trading one
  // blind spot for a bigger one.
  it("truncates a long message so it cannot blow the telemetry props budget", () => {
    const result = truncateClaimError("x".repeat(9_000));
    expect(result).toBeDefined();
    expect(result!.length).toBeLessThanOrEqual(CLAIM_ERROR_MAX_LEN);
  });

  it("keeps the head of a long message, where the provider puts the reason", () => {
    const result = truncateClaimError(`MiniPay denied the request${"…tail".repeat(500)}`);
    expect(result).toMatch(/^MiniPay denied the request/);
  });

  it("returns undefined when there is no message, so the field is omitted", () => {
    expect(truncateClaimError(undefined)).toBeUndefined();
    expect(truncateClaimError("")).toBeUndefined();
  });
});
