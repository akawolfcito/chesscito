import { describe, it, expect } from "vitest";

import { decryptKeystore, encryptKeystore } from "../crypto";

const TEST_PK = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80" as const;
const TEST_ADDR = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266" as const;

describe("encryptKeystore + decryptKeystore", () => {
  it("encrypts then decrypts a private key with the right password", () => {
    const ks = encryptKeystore(TEST_PK, "correct horse battery staple", TEST_ADDR);
    const recovered = decryptKeystore(ks, "correct horse battery staple");
    expect(recovered).toBe(TEST_PK);
  });

  it("rejects the wrong password with a generic error", () => {
    const ks = encryptKeystore(TEST_PK, "correct horse battery staple", TEST_ADDR);
    expect(() => decryptKeystore(ks, "wrong password")).toThrow(/wrong password|corrupted/i);
  });

  it("produces unique ciphertext + iv per encryption (randomized salt + iv)", () => {
    const a = encryptKeystore(TEST_PK, "samepass", TEST_ADDR);
    const b = encryptKeystore(TEST_PK, "samepass", TEST_ADDR);
    expect(a.ivHex).not.toBe(b.ivHex);
    expect(a.ciphertextHex).not.toBe(b.ciphertextHex);
    expect(a.kdf.saltHex).not.toBe(b.kdf.saltHex);
  });

  it("preserves the address as plaintext metadata for human verification", () => {
    const ks = encryptKeystore(TEST_PK, "p", TEST_ADDR);
    expect(ks.address).toBe(TEST_ADDR);
  });

  it("rejects a tampered ciphertext (GCM auth tag catches the bit flip)", () => {
    const ks = encryptKeystore(TEST_PK, "p", TEST_ADDR);
    const tampered = {
      ...ks,
      ciphertextHex: ks.ciphertextHex.replace(/.$/, (c) => (c === "0" ? "1" : "0")),
    };
    expect(() => decryptKeystore(tampered, "p")).toThrow(/wrong password|corrupted/i);
  });

  it("uses the documented scrypt KDF parameters (N=16384, r=8, p=1)", () => {
    const ks = encryptKeystore(TEST_PK, "p", TEST_ADDR);
    expect(ks.kdf).toMatchObject({ name: "scrypt", N: 16384, r: 8, p: 1 });
    expect(ks.cipher).toBe("aes-256-gcm");
  });
});
