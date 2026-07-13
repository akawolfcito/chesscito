import { describe, expect, it } from "vitest";
import { toFunctionSelector } from "viem";

import { CONTRACT_ERRORS_ABI } from "../generated/contract-errors";
import { decodeContractErrorName } from "../decode-contract-error";

/** Derived from the signature, never typed by hand — a selector is 4 bytes of a
 *  keccak hash and no reviewer can eyeball a typo in one.
 *
 *  Careful: `toFunctionSelector` hashes the string it is GIVEN. Pass it
 *  `"error Foo(uint256)"` and it hashes the word "error" along with the rest,
 *  returning a selector that belongs to nothing. Solidity hashes the bare
 *  signature, so that is what goes in here. */
function selectorOf(signature: string): `0x${string}` {
  return toFunctionSelector(signature);
}

/** 32 bytes of zeroes — a valid ABI-encoded word for every arg type below. */
const WORD = "00".repeat(32);

/** Verbatim from the iPhone / MiniPay capture of 2026-07-10 (`docs/testing/
 *  2026-07-10-minipay-raw-error-probe-results.md`): re-claiming a badge the
 *  wallet already owns. This is the one selector we have real device evidence
 *  for, and the reason this decoder exists. */
const DEVICE_BADGE_ALREADY_CLAIMED = "0xfafe7970";

describe("CONTRACT_ERRORS_ABI (generated)", () => {
  // A rename in the .sol without regenerating turns the decoder blind in
  // silence: the selector stops matching and every player falls back to the
  // generic revert copy. This is the tripwire for that.
  it.each([
    "BadgeAlreadyClaimed(address,uint256)",
    "CooldownActive(uint256)",
    "DailyLimitReached(uint256,uint256)",
    "SignatureExpired(uint256)",
    "MintCooldown(uint256)",
  ])("still declares %s", (signature) => {
    const name = signature.slice(0, signature.indexOf("("));
    const types = signature.slice(signature.indexOf("(") + 1, -1);
    const found = CONTRACT_ERRORS_ABI.find(
      (error) =>
        error.name === name && error.inputs.map((input) => input.type).join(",") === types,
    );
    expect(found).toBeDefined();
  });
});

describe("decodeContractErrorName", () => {
  // Anchors the generated ABI to the field measurement. If a contract change
  // ever moves this selector, the device evidence stops describing production
  // and we want to hear about it here, not from a player.
  it("decodes the exact revert data MiniPay returned on device", () => {
    const data = `${DEVICE_BADGE_ALREADY_CLAIMED}${WORD}${WORD}`;
    expect(decodeContractErrorName(data)).toBe("BadgeAlreadyClaimed");
    expect(selectorOf("BadgeAlreadyClaimed(address,uint256)")).toBe(DEVICE_BADGE_ALREADY_CLAIMED);
  });

  it("names CooldownActive", () => {
    const data = `${selectorOf("CooldownActive(uint256)")}${WORD}`;
    expect(decodeContractErrorName(data)).toBe("CooldownActive");
  });

  it("names DailyLimitReached", () => {
    const data = `${selectorOf("DailyLimitReached(uint256,uint256)")}${WORD}${WORD}`;
    expect(decodeContractErrorName(data)).toBe("DailyLimitReached");
  });

  it("names MintCooldown", () => {
    const data = `${selectorOf("MintCooldown(uint256)")}${WORD}`;
    expect(decodeContractErrorName(data)).toBe("MintCooldown");
  });

  // The whole module is a copy improvement. It is never allowed to become a
  // crash: every unreadable input returns null and the caller keeps the generic
  // revert message it would have shown anyway.
  it.each([
    ["null", null],
    ["undefined", undefined],
    ["empty string", ""],
    ["not hex at all", "execution reverted"],
    ["a bare 0x", "0x"],
    ["a selector no contract of ours declares", `0xdeadbeef${WORD}`],
    ["a known selector with truncated args", `${selectorOf("CooldownActive(uint256)")}00`],
    ["revert data cut short by a redactor", "0xfafe79"],
  ])("returns null for %s", (_label, data) => {
    expect(decodeContractErrorName(data as string | null | undefined)).toBeNull();
  });
});
