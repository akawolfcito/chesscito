import { describe, expect, it } from "vitest";
import { classifyTxErrorKind } from "../errors";

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
