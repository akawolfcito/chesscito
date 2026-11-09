import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ALGO = "aes-256-gcm";
const IV_BYTES = 12;

function parsePassphrase(passphrase: string): Buffer {
  if (!/^[0-9a-fA-F]{64}$/.test(passphrase)) {
    throw new Error("Passphrase must be exactly 64 hex characters (32 bytes)");
  }
  return Buffer.from(passphrase, "hex");
}

export function encryptSignerKey(plainKey: string, passphrase: string): string {
  const iv = randomBytes(IV_BYTES);
  const key = parsePassphrase(passphrase);
  const cipher = createCipheriv(ALGO, key, iv);
  const encrypted = Buffer.concat([cipher.update(plainKey, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted.toString("hex")}`;
}

export function decryptSignerKey(encrypted: string, passphrase: string): string {
  const parts = encrypted.split(":");
  if (parts.length !== 3) {
    throw new Error("Invalid encrypted format: expected iv:authTag:ciphertext");
  }
  const [ivHex, authTagHex, cipherHex] = parts;
  const key = parsePassphrase(passphrase);
  const decipher = createDecipheriv(ALGO, key, Buffer.from(ivHex, "hex"));
  decipher.setAuthTag(Buffer.from(authTagHex, "hex"));
  return decipher.update(cipherHex, "hex", "utf8") + decipher.final("utf8");
}
