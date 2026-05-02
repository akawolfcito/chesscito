import { describe, it, expect } from "vitest";
import { formatWalletShort, isWalletShortShape } from "../format";

describe("formatWalletShort", () => {
  it("truncates a 0x address to the canonical `0xABCD…1234` shape", () => {
    const result = formatWalletShort(
      "0x1234567890abcdef1234567890abcdef12345678",
    );
    expect(result).toBe("0x1234…5678");
  });

  it("preserves casing of the input hex", () => {
    const result = formatWalletShort(
      "0xAbCdEf1234567890abcdef1234567890abCdEf12",
    );
    expect(result).toBe("0xAbCd…Ef12");
  });

  it("throws on an address shorter than the truncation window", () => {
    expect(() => formatWalletShort("0x123")).toThrowError();
  });

  it("throws on a non-0x string", () => {
    expect(() => formatWalletShort("not-a-wallet")).toThrowError();
  });

  it("throws on the empty string", () => {
    expect(() => formatWalletShort("")).toThrowError();
  });
});

describe("isWalletShortShape", () => {
  it("accepts the canonical shape", () => {
    expect(isWalletShortShape("0x1234…abcd")).toBe(true);
    expect(isWalletShortShape("0xABCD…1234")).toBe(true);
  });

  it("rejects manual slice patterns like `0x1234567890`", () => {
    expect(isWalletShortShape("0x1234567890")).toBe(false);
  });

  it("rejects a missing horizontal-ellipsis (3-dot fallback)", () => {
    expect(isWalletShortShape("0x1234...abcd")).toBe(false);
  });

  it("rejects non-hex characters in the windows", () => {
    expect(isWalletShortShape("0x12g4…abcd")).toBe(false);
  });

  it("rejects the empty string", () => {
    expect(isWalletShortShape("")).toBe(false);
  });
});
