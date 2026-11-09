import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";

/** On-disk shape of the encrypted admin keystore. The address is
 *  intentionally stored unencrypted so a human can `pnpm admin wallet
 *  address` to confirm "which key is this?" without typing the
 *  password. The PK itself only comes out of memory in plaintext when
 *  scryptSync + GCM-decrypt succeed with the right password. */
export type EncryptedKeystore = {
  version: 1;
  kdf: {
    name: "scrypt";
    N: number;
    r: number;
    p: number;
    saltHex: string;
  };
  cipher: "aes-256-gcm";
  ivHex: string;
  authTagHex: string;
  ciphertextHex: string;
  address: `0x${string}`;
  createdAt: string;
};

type ScryptParams = { N: number; r: number; p: number };

/** Conservative scrypt parameters. Same magnitude geth and other
 *  Ethereum keystores use; a brute-force attempt against a
 *  16-character random password takes ~10^14 GPU-years today. */
const KDF: ScryptParams = { N: 1 << 14, r: 8, p: 1 };
const KEY_LEN = 32;
const IV_BYTES = 12;
const SALT_BYTES = 16;
const ALGO = "aes-256-gcm";

function deriveKey(password: string, salt: Buffer, params: ScryptParams = KDF): Buffer {
  return scryptSync(password, salt, KEY_LEN, params);
}

function scrub(buf: Buffer): void {
  buf.fill(0);
}

/** Encrypt a 0x-prefixed 32-byte private key using a user-chosen
 *  password. Returns the keystore object ready to be JSON.stringify'd
 *  and persisted. */
export function encryptKeystore(
  privateKey: `0x${string}`,
  password: string,
  address: `0x${string}`,
): EncryptedKeystore {
  const salt = randomBytes(SALT_BYTES);
  const key = deriveKey(password, salt);
  try {
    const iv = randomBytes(IV_BYTES);
    const cipher = createCipheriv(ALGO, key, iv);
    const ciphertext = Buffer.concat([cipher.update(privateKey, "utf8"), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return {
      version: 1,
      kdf: { name: "scrypt", N: KDF.N, r: KDF.r, p: KDF.p, saltHex: salt.toString("hex") },
      cipher: ALGO,
      ivHex: iv.toString("hex"),
      authTagHex: authTag.toString("hex"),
      ciphertextHex: ciphertext.toString("hex"),
      address,
      createdAt: new Date().toISOString(),
    };
  } finally {
    scrub(key);
  }
}

/** Decrypt the keystore. Throws a generic "wrong password" message on
 *  any failure path (auth-tag mismatch, malformed input) so an
 *  attacker can't distinguish "wrong password" from "tampered
 *  ciphertext" via timing or error text. */
export function decryptKeystore(ks: EncryptedKeystore, password: string): `0x${string}` {
  const salt = Buffer.from(ks.kdf.saltHex, "hex");
  const key = deriveKey(password, salt, { N: ks.kdf.N, r: ks.kdf.r, p: ks.kdf.p });
  try {
    const decipher = createDecipheriv(ALGO, key, Buffer.from(ks.ivHex, "hex"));
    decipher.setAuthTag(Buffer.from(ks.authTagHex, "hex"));
    const plain = Buffer.concat([
      decipher.update(Buffer.from(ks.ciphertextHex, "hex")),
      decipher.final(),
    ]);
    const result = plain.toString("utf8") as `0x${string}`;
    scrub(plain);
    if (!/^0x[0-9a-fA-F]{64}$/.test(result)) {
      throw new Error("Decrypted plaintext is not a 32-byte hex private key");
    }
    return result;
  } catch {
    throw new Error("Decryption failed — wrong password or corrupted keystore");
  } finally {
    scrub(key);
  }
}
