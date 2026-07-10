import { describe, expect, it } from "vitest";
import type { Hash, TransactionReceipt } from "viem";
import {
  classifyTxErrorKind,
  isReceiptUnverifiable,
  isTransactionReverted,
} from "../errors";
import {
  TransactionReceiptUnverifiableError,
  TransactionRevertedError,
} from "../contracts/transaction-helpers";

describe("classifyTxErrorKind — ERC2612 permit reverts", () => {
  it("classifies ERC2612ExpiredSignature as revert", () => {
    const err = new Error("execution reverted: ERC2612ExpiredSignature(1234)");
    expect(classifyTxErrorKind(err)).toBe("revert");
  });

  it("classifies ERC2612InvalidSigner as revert", () => {
    const err = new Error(
      "execution reverted: ERC2612InvalidSigner(0x1111111111111111111111111111111111111111, 0x2222222222222222222222222222222222222222)",
    );
    expect(classifyTxErrorKind(err)).toBe("revert");
  });
});

/** Captured verbatim from `simulateContract` against the mainnet Scoreboard
 *  (`0x1681aAA1…`) on 2026-07-09. viem echoes the call args into the message,
 *  so any score / timeMs / deadline / nonce containing the digits "400" used
 *  to hijack the `signingUnavailable` branch, which is evaluated before the
 *  `revert` branch. The fixture is real output, not a paraphrase — a
 *  hand-written approximation is exactly what let this survive. */
const REAL_REVERT_MESSAGE = [
  'The contract function "submitScoreSigned" reverted with the following signature:',
  "0xcd21db4f",
  "",
  'Unable to decode signature "0xcd21db4f" as it was not found on the provided ABI.',
  "Make sure you are using the correct ABI and that the error exists on it.",
  "You can look up the decoded signature here: https://4byte.sourcify.dev/?q=0xcd21db4f.",
  " ",
  "Contract Call:",
  "  address:   0x1681aAA176d5f46e45789A8b18C8E990f663959a",
  "  function:  submitScoreSigned(uint256 levelId, uint256 score, uint256 timeMs, uint256 nonce, uint256 deadline, bytes signature)",
  "  args:                       (1, 2400, 18000, 7, 1783000000, 0x1111)",
].join("\n");

describe("classifyTxErrorKind — revert vs signingUnavailable disambiguation", () => {
  it("classifies a real on-chain revert as revert even when its args contain 400", () => {
    expect(classifyTxErrorKind(new Error(REAL_REVERT_MESSAGE))).toBe("revert");
  });

  it.each([
    ["score", "args: (1, 2400, 18000, 7, 1783000000)"],
    ["timeMs", "args: (1, 90, 400123, 7, 1783000000)"],
    ["deadline", "args: (1, 90, 18000, 7, 1784001234)"],
    ["nonce", "args: (1, 90, 18000, 400, 1783000000)"],
  ])("does not read a %s containing 400 as a signing failure", (_field, args) => {
    const err = new Error(`execution reverted\n  ${args}`);
    expect(classifyTxErrorKind(err)).toBe("revert");
  });

  it("still classifies a real signing-endpoint env failure as signingUnavailable", () => {
    const err = new Error("Missing required env: DRAGON");
    expect(classifyTxErrorKind(err)).toBe("signingUnavailable");
  });

  it("classifies the requestSignature fallback message as signingUnavailable", () => {
    // `requestSignature` throws this when /api/sign-* returns a body with no
    // `error` field. It reached `unknown` before, so the player saw
    // "Something went wrong" for a server-side outage.
    const err = new Error("Could not fetch signature");
    expect(classifyTxErrorKind(err)).toBe("signingUnavailable");
  });

  it("classifies the sign-badge route fallback as signingUnavailable", () => {
    const err = new Error("Could not sign badge claim");
    expect(classifyTxErrorKind(err)).toBe("signingUnavailable");
  });

  it("still classifies an explicit HTTP 4xx from a signing call as signingUnavailable", () => {
    expect(classifyTxErrorKind(new Error("HTTP 400"))).toBe("signingUnavailable");
    expect(classifyTxErrorKind(new Error("sign-victory failed: HTTP 403"))).toBe(
      "signingUnavailable",
    );
  });

  it("does not read a bare 400 inside an address or hash as HTTP 4xx", () => {
    const err = new Error(
      "execution reverted\n  address: 0x400aAA176d5f46e45789A8b18C8E990f663959a",
    );
    expect(classifyTxErrorKind(err)).toBe("revert");
  });
});

describe("classifyTxErrorKind — TransactionRevertedError is typed, not parsed", () => {
  const HASH = "0x4001beef" as Hash;
  const receipt = { status: "reverted" } as unknown as TransactionReceipt;

  it("classifies a TransactionRevertedError as revert", () => {
    expect(classifyTxErrorKind(new TransactionRevertedError(HASH, receipt))).toBe("revert");
  });

  // The whole point of the typed error: classification must not depend on the
  // prose of `message`. A revert whose message happens to read like an HTTP
  // 4xx must still classify as a revert, because we know what it IS.
  it("wins over the string heuristics even when the message reads like an HTTP 400", () => {
    const err = new TransactionRevertedError(HASH, receipt);
    Object.defineProperty(err, "message", { value: "HTTP 400 signing failed" });
    expect(classifyTxErrorKind(err)).toBe("revert");
  });

  it("recognises a cross-realm duck-typed revert by name", () => {
    // Same escape hatch `isTransactionTimeout` already relies on (errors.ts:11)
    // for errors that cross a bundle/realm boundary and lose `instanceof`.
    const err = Object.assign(new Error("HTTP 400"), {
      name: "TransactionRevertedError",
    });
    expect(isTransactionReverted(err)).toBe(true);
    expect(classifyTxErrorKind(err)).toBe("revert");
  });

  it("does not treat a plain Error as reverted", () => {
    expect(isTransactionReverted(new Error("boom"))).toBe(false);
  });

  // A typed revert must not be demoted to `cancelled` because its prose happens
  // to contain a cancellation keyword. `isUserCancellation` is a substring
  // scan; the typed check has to run ahead of it.
  it("wins over the cancellation heuristic", () => {
    const err = new TransactionRevertedError(HASH, receipt);
    Object.defineProperty(err, "message", { value: "User rejected the request" });
    expect(classifyTxErrorKind(err)).toBe("revert");
  });

  it("still classifies a plain wallet rejection as cancelled", () => {
    // Untyped: the heuristic remains the only signal, and must stay silent.
    expect(classifyTxErrorKind(new Error("User rejected the request"))).toBe("cancelled");
  });
});

describe("classifyTxErrorKind — an unverifiable receipt is not a revert", () => {
  const HASH = "0xdeadbeef" as Hash;
  const receipt = { transactionHash: HASH } as unknown as TransactionReceipt;

  it("classifies TransactionReceiptUnverifiableError as unknown, never revert", () => {
    const err = new TransactionReceiptUnverifiableError(HASH, receipt, undefined);
    expect(classifyTxErrorKind(err)).toBe("unknown");
    expect(classifyTxErrorKind(err)).not.toBe("revert");
  });

  it("is not reported as a revert by isTransactionReverted", () => {
    const err = new TransactionReceiptUnverifiableError(HASH, receipt, "pending");
    expect(isTransactionReverted(err)).toBe(false);
    expect(isReceiptUnverifiable(err)).toBe(true);
  });

  it("recognises a cross-realm duck-typed unverifiable receipt by name", () => {
    const err = Object.assign(new Error("HTTP 400"), {
      name: "TransactionReceiptUnverifiableError",
    });
    expect(isReceiptUnverifiable(err)).toBe(true);
    expect(classifyTxErrorKind(err)).toBe("unknown");
  });

  it("does not treat a plain Error as unverifiable", () => {
    expect(isReceiptUnverifiable(new Error("boom"))).toBe(false);
  });
});
