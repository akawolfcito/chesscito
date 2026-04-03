import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { encryptSignerKey, decryptSignerKey } from "../crypto.js";

// A known 32-byte passphrase (64 hex chars)
const TEST_PASSPHRASE = "a".repeat(64);
const TEST_KEY = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";

describe("encryptSignerKey", () => {
  it("returns iv:authTag:ciphertext format (3 hex segments)", () => {
    const result = encryptSignerKey(TEST_KEY, TEST_PASSPHRASE);
    const segments = result.split(":");
    assert.equal(segments.length, 3, `Expected 3 segments, got ${segments.length}`);
    for (const seg of segments) {
      assert.match(seg, /^[0-9a-f]+$/i, `Segment is not valid hex: ${seg}`);
    }
  });

  it("produces different ciphertext each call (random IV)", () => {
    const a = encryptSignerKey(TEST_KEY, TEST_PASSPHRASE);
    const b = encryptSignerKey(TEST_KEY, TEST_PASSPHRASE);
    assert.notEqual(a, b);
  });
});

describe("decryptSignerKey", () => {
  it("roundtrips: encrypt then decrypt returns original key", () => {
    const encrypted = encryptSignerKey(TEST_KEY, TEST_PASSPHRASE);
    const decrypted = decryptSignerKey(encrypted, TEST_PASSPHRASE);
    assert.equal(decrypted, TEST_KEY);
  });

  it("throws on wrong passphrase", () => {
    const encrypted = encryptSignerKey(TEST_KEY, TEST_PASSPHRASE);
    const wrongPassphrase = "b".repeat(64);
    assert.throws(() => decryptSignerKey(encrypted, wrongPassphrase));
  });

  it("throws on malformed input (wrong segment count)", () => {
    assert.throws(
      () => decryptSignerKey("onlyone", TEST_PASSPHRASE),
      { message: "Invalid encrypted format: expected iv:authTag:ciphertext" }
    );
    assert.throws(
      () => decryptSignerKey("one:two", TEST_PASSPHRASE),
      { message: "Invalid encrypted format: expected iv:authTag:ciphertext" }
    );
  });

  it("throws on invalid hex in segments", () => {
    assert.throws(
      () => decryptSignerKey("zzzz:yyyy:xxxx", TEST_PASSPHRASE)
    );
  });
});
