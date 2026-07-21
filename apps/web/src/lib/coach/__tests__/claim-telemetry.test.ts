import { describe, expect, it } from "vitest";

import { CLAIM_ERROR_MAX_LEN, truncateClaimError } from "../claim-telemetry";

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
