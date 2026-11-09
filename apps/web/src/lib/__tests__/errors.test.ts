import { describe, expect, it } from "vitest";
import { toFunctionSelector, type Hash, type TransactionReceipt } from "viem";
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

/** Wraps revert data the way MiniPay actually delivers it: the node's JSON-RPC
 *  error blob, stringified into viem's message. Measured on device 2026-07-10 —
 *  `error.data`, `.raw` and `.signature` all come back null, so the text is the
 *  only carrier. */
function minipayRevert(fn: string, data: string): Error {
  return new Error(
    `The contract function "${fn}" reverted with the following reason:\n` +
      "Remote method 'eth_estimateGas' failed with an error: " +
      '{"jsonrpc":"2.0","id":1,"error":{"code":3,"message":"execution reverted",' +
      `"data":"${data}"}}`,
  );
}

/** 32 bytes of zeroes — a valid ABI-encoded word for every arg type below. */
const WORD = "00".repeat(32);

/** Revert data for `signature`, with `args` zero-filled words.
 *
 *  Selectors are DERIVED, never typed: they are 4 bytes of a keccak hash, and
 *  no reviewer can spot a wrong one. Note `toFunctionSelector` hashes the exact
 *  string it is handed — give it `"error Foo(uint256)"` and it hashes the word
 *  "error" too, returning a selector that belongs to nothing. Solidity hashes
 *  the bare signature, so that is what goes in. */
function revertData(signature: string, args: number): string {
  return `${toFunctionSelector(signature)}${WORD.repeat(args)}`;
}

const BADGE_ALREADY_CLAIMED = revertData("BadgeAlreadyClaimed(address,uint256)", 2);
const COOLDOWN_ACTIVE = revertData("CooldownActive(uint256)", 1);
const DAILY_LIMIT_REACHED = revertData("DailyLimitReached(uint256,uint256)", 2);
const MINT_COOLDOWN = revertData("MintCooldown(uint256)", 1);
const SIGNATURE_EXPIRED = revertData("SignatureExpired(uint256)", 1);
/** Decodable, but the player gets no special words for it. Nobody wants to read
 *  "ItemDisabled" off a phone. */
const ITEM_DISABLED = revertData("ItemDisabled(uint256)", 1);

describe("classifyTxErrorKind — custom errors decoded from revert data", () => {
  it("reads BadgeAlreadyClaimed out of MiniPay's message", () => {
    const err = minipayRevert("claimBadgeSigned", BADGE_ALREADY_CLAIMED);
    expect(classifyTxErrorKind(err)).toBe("badgeAlreadyClaimed");
  });

  it("reads CooldownActive", () => {
    const err = minipayRevert("submitScoreSigned", COOLDOWN_ACTIVE);
    expect(classifyTxErrorKind(err)).toBe("cooldownActive");
  });

  it("reads DailyLimitReached", () => {
    const err = minipayRevert("submitScoreSigned", DAILY_LIMIT_REACHED);
    expect(classifyTxErrorKind(err)).toBe("dailyLimitReached");
  });

  // Two contracts, two names, one thing to tell the player: wait a moment.
  it("folds VictoryNFT's MintCooldown into the same cooldown copy", () => {
    const err = minipayRevert("mintVictorySigned", MINT_COOLDOWN);
    expect(classifyTxErrorKind(err)).toBe("cooldownActive");
  });

  it("reads SignatureExpired", () => {
    const err = minipayRevert("claimBadgeSigned", SIGNATURE_EXPIRED);
    expect(classifyTxErrorKind(err)).toBe("signatureExpired");
  });

  // Decodable is not the same as player-facing. An operator/config error gets
  // the generic revert copy, exactly as it does today.
  it("leaves an error with no player copy as a generic revert", () => {
    const err = minipayRevert("buyItem", ITEM_DISABLED);
    expect(classifyTxErrorKind(err)).toBe("revert");
  });

  // Also delivered structured by wallets that are not MiniPay. Never seen in
  // the field; cheap to accept.
  it("reads revert data a wallet attached as a structured field", () => {
    const err = Object.assign(new Error("execution reverted"), {
      data: COOLDOWN_ACTIVE,
    });
    expect(classifyTxErrorKind(err)).toBe("cooldownActive");
  });

  it("finds revert data nested in the cause chain", () => {
    // viem wraps: the readable summary is on top, the node's blob is a cause or
    // two down. `cause` is assigned rather than passed to the constructor —
    // the tsconfig lib predates the ES2022 Error options argument.
    const inner = minipayRevert("submitScoreSigned", DAILY_LIMIT_REACHED);
    const outer = Object.assign(new Error("Transaction failed"), { cause: inner });
    expect(classifyTxErrorKind(outer)).toBe("dailyLimitReached");
  });
});

describe("classifyTxErrorKind — the decoder degrades, it never lies", () => {
  // Risk #1 in the plan: the message shape is a provider's stringified error,
  // not an API. MiniPay can change it in a patch release and this extractor
  // would stop matching IN SILENCE. When it does, the player must land exactly
  // where they land today — on the generic revert copy — not on a crash and not
  // on a wrong kind.
  it("falls back to a generic revert when the message shape changes", () => {
    const err = new Error(
      "Remote method 'eth_estimateGas' failed: execution reverted, revertData=0xfafe7970",
    );
    expect(classifyTxErrorKind(err)).toBe("revert");
  });

  it("falls back to a generic revert when the selector is unknown to us", () => {
    const err = minipayRevert("submitScoreSigned", `0xdeadbeef${WORD}`);
    expect(classifyTxErrorKind(err)).toBe("revert");
  });

  // Risk #3: a wallet rejection arrives as viem's ContractFunctionRevertedError
  // — a REVERT-shaped class for something that never reached the chain. The
  // decoder must not get a vote before `isUserCancellation`, or every cancelled
  // tx becomes a reported failure.
  it("still calls a wallet rejection cancelled, even carrying revert data", () => {
    const err = Object.assign(new Error("User rejected the request"), {
      name: "ContractFunctionRevertedError",
      data: BADGE_ALREADY_CLAIMED,
    });
    expect(classifyTxErrorKind(err)).toBe("cancelled");
  });

  it("still calls a timeout a timeout, even carrying revert data", () => {
    const err = Object.assign(new Error("Transaction timed out"), {
      data: COOLDOWN_ACTIVE,
    });
    expect(classifyTxErrorKind(err)).toBe("timeout");
  });
});
