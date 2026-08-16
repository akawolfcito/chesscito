import { describe, expect, it } from "vitest";

import {
  CLAIM_ERROR_MAX_LEN,
  classifyClaimError,
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

/**
 * Measured against production on 2026-08-16 (paso 0 del lote 2,
 * `docs/audits/2026-08-16-mint-error-corpus-step0.md`): 148 of the 161 wallets
 * whose mint failed as `error_kind: "unknown"` carried ONE message — the
 * app's own "No token with sufficient balance" guard.
 *
 * The player was never misled: the UI branch already mapped that message to
 * `insufficientFunds` and rendered the add-funds CTA. TELEMETRY was the half
 * that was wrong, because it re-derived the kind from `classifyTxErrorKind`,
 * which does not know that guard. `insufficientFunds` therefore reported 7
 * wallets while 148 sat in `unknown` — a 21× undercount.
 *
 * ⛔ The fix is not a new classifier. It is ONE decision, consumed twice, so
 * the two answers cannot drift apart again.
 */
describe("classifyClaimError — one decision, two consumers", () => {
  const noToken = new Error("No token with sufficient balance");

  it("reports the balance guard as insufficientFunds to the UI", () => {
    expect(classifyClaimError(noToken).kind).toBe("insufficientFunds");
  });

  it("reports the SAME kind to telemetry — this is the 21× undercount", () => {
    expect(classifyClaimError(noToken).telemetryKind).toBe("insufficientFunds");
  });

  it("keeps `expired` as a telemetry-only sentinel, null for the UI", () => {
    // Deliberate asymmetry, not drift: `expired` is not a TxErrorKind, so
    // consumers must not have to mirror a sentinel that means "no kind".
    const expired = new Error("signature expired");
    expect(classifyClaimError(expired).kind).toBeNull();
    expect(classifyClaimError(expired).telemetryKind).toBe("expired");
  });

  it("expired outranks the balance guard, as it did before", () => {
    const both = new Error("No token with sufficient balance — signature expired");
    expect(classifyClaimError(both).kind).toBeNull();
    expect(classifyClaimError(both).telemetryKind).toBe("expired");
  });

  it("falls through to the classifier for everything else", () => {
    const rateLimited = new Error("Rate limit exceeded");
    const { kind, telemetryKind } = classifyClaimError(rateLimited);
    expect(telemetryKind).toBe(String(kind));
  });

  it("INVARIANT: outside the expired sentinel, both consumers agree", () => {
    // The property the whole change exists to guarantee. If a future branch
    // teaches one consumer something the other does not know, this fails.
    const cases = [
      new Error("No token with sufficient balance"),
      new Error("Rate limit exceeded"),
      new Error("Illegal move in transcript"),
      new Error("User rejected the request"),
      new Error("insufficient funds for gas"),
      new Error("something nobody has seen"),
      "a bare string, not an Error",
      null,
    ];
    for (const err of cases) {
      const { kind, telemetryKind } = classifyClaimError(err);
      if (telemetryKind === "expired") continue;
      expect(telemetryKind).toBe(String(kind));
    }
  });
});
