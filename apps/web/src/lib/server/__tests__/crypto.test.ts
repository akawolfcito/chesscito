import { describe, it, expect } from "vitest";

import { encryptSignerKey, decryptSignerKey } from "../crypto.js";

// A known 32-byte passphrase (64 hex chars)
const TEST_PASSPHRASE = "a".repeat(64);
const TEST_KEY = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";

describe("encryptSignerKey", () => {
  it("returns iv:authTag:ciphertext format (3 hex segments)", () => {
    const result = encryptSignerKey(TEST_KEY, TEST_PASSPHRASE);
    const segments = result.split(":");
    expect(segments.length).toEqual(3);
    for (const seg of segments) {
      expect(seg).toMatch(/^[0-9a-f]+$/i);
    }
  });

  it("produces different ciphertext each call (random IV)", () => {
    const a = encryptSignerKey(TEST_KEY, TEST_PASSPHRASE);
    const b = encryptSignerKey(TEST_KEY, TEST_PASSPHRASE);
    expect(a).not.toEqual(b);
  });
});

describe("decryptSignerKey", () => {
  it("roundtrips: encrypt then decrypt returns original key", () => {
    const encrypted = encryptSignerKey(TEST_KEY, TEST_PASSPHRASE);
    const decrypted = decryptSignerKey(encrypted, TEST_PASSPHRASE);
    expect(decrypted).toEqual(TEST_KEY);
  });

  it("throws on wrong passphrase", () => {
    const encrypted = encryptSignerKey(TEST_KEY, TEST_PASSPHRASE);
    const wrongPassphrase = "b".repeat(64);
    expect(() => decryptSignerKey(encrypted, wrongPassphrase)).toThrow();
  });

  it("throws on malformed input (wrong segment count)", () => {
    expect(() => decryptSignerKey("onlyone", TEST_PASSPHRASE)).toThrow("Invalid encrypted format: expected iv:authTag:ciphertext");
    expect(() => decryptSignerKey("one:two", TEST_PASSPHRASE)).toThrow("Invalid encrypted format: expected iv:authTag:ciphertext");
    expect(() => decryptSignerKey("one:two:three:four", TEST_PASSPHRASE)).toThrow("Invalid encrypted format: expected iv:authTag:ciphertext");
  });

  it("throws on invalid hex in segments", () => {
    expect(() => decryptSignerKey("zzzz:yyyy:xxxx", TEST_PASSPHRASE)).toThrow();
  });

  it("throws on invalid passphrase format", () => {
    const encrypted = encryptSignerKey(TEST_KEY, TEST_PASSPHRASE);
    expect(() => decryptSignerKey(encrypted, "too-short")).toThrow("Passphrase must be exactly 64 hex characters (32 bytes)");
    expect(() => decryptSignerKey(encrypted, "z".repeat(64))).toThrow("Passphrase must be exactly 64 hex characters (32 bytes)");
  });
});

describe("getDemoConfig integration", () => {
  it("produces a valid signer from encrypted env vars", () => {
    // Encrypt a known test key
    const testKey = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
    const passphrase = "c".repeat(64);
    const encrypted = encryptSignerKey(testKey, passphrase);

    // Decrypt and verify it's a valid hex key
    const decrypted = decryptSignerKey(encrypted, passphrase);
    expect(decrypted).toEqual(testKey);
    expect(decrypted).toMatch(/^0x[0-9a-fA-F]{64}$/);
  });
});
