import { describe, expect, it } from "vitest";

import { classifyPocResult, isAllowanceFailure } from "../result";

describe("classifyPocResult", () => {
  it("is inconclusive when success used an existing sufficient allowance", () => {
    expect(
      classifyPocResult({
        status: "success",
        contractTxAttempted: true,
        allowanceBefore: 10n,
        requiredAmount: 10n,
        error: null,
      }).conclusion,
    ).toBe("inconclusive");
  });

  it("proves approve removable for this flow when success had insufficient allowance", () => {
    expect(
      classifyPocResult({
        status: "success",
        contractTxAttempted: true,
        allowanceBefore: 9n,
        requiredAmount: 10n,
        error: null,
      }).conclusion,
    ).toBe("yes");
  });

  it.each([
    "ERC20: insufficient allowance",
    "transfer amount exceeds allowance",
    "SafeERC20: transferFrom failed",
  ])("requires approve for an authorization failure: %s", (error) => {
    expect(isAllowanceFailure(error)).toBe(true);
    expect(
      classifyPocResult({
        status: "failed",
        contractTxAttempted: true,
        allowanceBefore: 0n,
        requiredAmount: 10n,
        error,
      }).conclusion,
    ).toBe("no");
  });

  it("is inconclusive for a non-allowance failure", () => {
    expect(
      classifyPocResult({
        status: "failed",
        contractTxAttempted: true,
        allowanceBefore: 0n,
        requiredAmount: 10n,
        error: "Item disabled",
      }).conclusion,
    ).toBe("inconclusive");
  });

  it("is inconclusive when the allowance read fails before buyItem is attempted", () => {
    expect(
      classifyPocResult({
        status: "failed",
        contractTxAttempted: false,
        allowanceBefore: null,
        requiredAmount: 10n,
        error: "allowance RPC request failed",
      }).conclusion,
    ).toBe("inconclusive");
  });
});
