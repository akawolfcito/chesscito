import { describe, expect, it } from "vitest";
import { ACCOUNT_REF_LEN, deriveAccountRef } from "../account-ref";

const ADDR = "0xAbC0000000000000000000000000000000000001";
const SECRET = "test-secret-not-a-real-one";

describe("deriveAccountRef", () => {
  it("is stable for the same address and secret", () => {
    expect(deriveAccountRef(ADDR, SECRET)).toBe(deriveAccountRef(ADDR, SECRET));
  });

  it("is case-insensitive on the address", () => {
    expect(deriveAccountRef(ADDR.toLowerCase(), SECRET)).toBe(
      deriveAccountRef(ADDR.toUpperCase().replace("0X", "0x"), SECRET),
    );
  });

  it("matches the column's hex constraint", () => {
    expect(deriveAccountRef(ADDR, SECRET)).toMatch(
      new RegExp(`^[0-9a-f]{${ACCOUNT_REF_LEN}}$`),
    );
  });

  it("does not contain the address — the wallet must not survive the derivation", () => {
    const ref = deriveAccountRef(ADDR, SECRET)!;
    expect(ref).not.toContain(ADDR.slice(2, 10).toLowerCase());
  });

  it("changes completely when the secret rotates", () => {
    expect(deriveAccountRef(ADDR, SECRET)).not.toBe(
      deriveAccountRef(ADDR, "a-different-secret"),
    );
  });

  it("separates two addresses", () => {
    const other = "0xAbC0000000000000000000000000000000000002";
    expect(deriveAccountRef(ADDR, SECRET)).not.toBe(
      deriveAccountRef(other, SECRET),
    );
  });

  it("returns null with no secret, so the column stays empty instead of weak", () => {
    expect(deriveAccountRef(ADDR, undefined)).toBeNull();
    expect(deriveAccountRef(ADDR, "")).toBeNull();
  });

  it("returns null for anything that is not an address", () => {
    expect(deriveAccountRef(null, SECRET)).toBeNull();
    expect(deriveAccountRef("", SECRET)).toBeNull();
    expect(deriveAccountRef("not-an-address", SECRET)).toBeNull();
    expect(deriveAccountRef("0x123", SECRET)).toBeNull();
    expect(deriveAccountRef(`${ADDR}00`, SECRET)).toBeNull();
    expect(deriveAccountRef(12345, SECRET)).toBeNull();
  });
});
