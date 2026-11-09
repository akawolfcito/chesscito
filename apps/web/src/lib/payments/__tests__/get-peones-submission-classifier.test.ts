import { describe, expect, it } from "vitest";

import {
  classifyProviderSubmissionError,
  getProviderErrorDiagnostics,
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

  it("classifies prepare and simulate failures as retry-safe pre-broadcast", () => {
    expect(classifyProviderSubmissionError(new Error("bad request"), "PREPARE"))
      .toMatchObject({
        submissionState: "FAILED",
        providerResultKind: "PRE_BROADCAST_FAILURE",
        errorCode: "PREPARE_FAILED",
        retrySafe: true,
      });
    expect(classifyProviderSubmissionError(new Error("simulation reverted"), "SIMULATE"))
      .toMatchObject({
        submissionState: "FAILED",
        providerResultKind: "PRE_BROADCAST_FAILURE",
        errorCode: "SIMULATE_FAILED",
        retrySafe: true,
      });
  });

  it("finds MiniPay estimate failures nested under viem while preserving code -1", () => {
    expect(classifyProviderSubmissionError({
      code: -1,
      cause: {
        details: "Remote method 'eth_estimateGas' failed with an error",
      },
    })).toMatchObject({
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

  it("allowlists diagnostic fields and redacts calldata-like hex", () => {
    const calldata = `0x${"ab".repeat(80)}`;
    const diagnostics = getProviderErrorDiagnostics({
      name: "ContractFunctionExecutionError",
      code: -1,
      shortMessage: `rejected ${calldata}`,
      details: `request ${calldata}`,
      stack: "must not be copied",
      cause: {
        name: "UnknownRpcError",
        code: -1,
        shortMessage: "unknown provider failure",
        data: { calldata },
      },
    });
    expect(diagnostics).toMatchObject({
      name: "ContractFunctionExecutionError",
      code: "-1",
      shortMessage: "rejected [redacted_hex]",
      details: "request [redacted_hex]",
      causeName: "UnknownRpcError",
      causeCode: "-1",
      causeShortMessage: "unknown provider failure",
    });
    expect(JSON.stringify(diagnostics)).not.toContain(calldata);
    expect(diagnostics).not.toHaveProperty("stack");
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
