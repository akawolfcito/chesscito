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
