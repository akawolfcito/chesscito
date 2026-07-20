import { describe, expect, it } from "vitest";

import {
  classifyProviderSubmissionError,
  normalizeProviderTransactionHash,
  recoverProviderTransactionHashFromError,
} from "@/lib/payments/get-peones-canary";

const HASH = `0x${"a".repeat(64)}` as const;

describe("Get Peones provider submission classifier", () => {
  it("recognizes EIP-1193 cancellation by code 4001 without relying on prose", () => {
    expect(classifyProviderSubmissionError({ code: 4001 })).toEqual({
      submissionState: "CANCELLED",
      providerResultKind: "USER_CANCELLED",
      errorCode: "4001",
      recoverable: true,
      retrySafe: true,
    });
  });

  it("marks explicit estimate-gas failures as proven pre-broadcast failures", () => {
    expect(classifyProviderSubmissionError(
      new Error("Remote method 'eth_estimateGas' failed with an error"),
    )).toMatchObject({
      submissionState: "FAILED",
      providerResultKind: "PRE_BROADCAST_FAILURE",
      errorCode: "ESTIMATE_GAS_FAILED",
      retrySafe: true,
    });
  });

  it("keeps an unclassified provider rejection ambiguous and retry-blocked", () => {
    expect(classifyProviderSubmissionError(new Error("provider timeout"))).toMatchObject({
      submissionState: "SUBMITTING",
      providerResultKind: "AMBIGUOUS_ERROR",
      errorCode: "PROVIDER_ERROR",
      recoverable: true,
      retrySafe: false,
    });
  });

  it("normalizes direct, transactionHash, and hash provider results", () => {
    expect(normalizeProviderTransactionHash(HASH)).toMatchObject({ ok: true, txHash: HASH });
    expect(normalizeProviderTransactionHash({ transactionHash: HASH })).toMatchObject({
      ok: true,
      txHash: HASH,
    });
    expect(normalizeProviderTransactionHash({ hash: HASH })).toMatchObject({
      ok: true,
      txHash: HASH,
    });
  });

  it("does not invent a hash for an unexpected provider result", () => {
    expect(normalizeProviderTransactionHash({ status: "pending" })).toEqual({
      ok: false,
      outcome: {
        submissionState: "SUBMITTING",
        providerResultKind: "UNEXPECTED_RESULT",
        errorCode: "UNEXPECTED_PROVIDER_RESULT",
        recoverable: true,
        retrySafe: false,
      },
    });
  });

  it("recovers only transaction-specific hashes from rejected provider results", () => {
    expect(recoverProviderTransactionHashFromError({
      cause: { receipt: { transactionHash: HASH } },
    })).toBe(HASH);
    expect(recoverProviderTransactionHashFromError({ hash: HASH })).toBeNull();
  });
});
