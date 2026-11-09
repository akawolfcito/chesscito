import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { privateKeyToAccount } from "viem/accounts";
import type { PrivateKeyAccount } from "viem";

import { decryptKeystore, encryptKeystore, type EncryptedKeystore } from "@/lib/crypto";
import { promptHidden } from "@/lib/prompt";

const __dirname = dirname(fileURLToPath(import.meta.url));
/** Single canonical location for the admin keystore. Lives inside the
 *  admin package + `.private/` (gitignored) so backups, screenshots
 *  and accidental git adds don't catch it. */
export const KEYSTORE_PATH = join(__dirname, "..", "..", ".private", "admin-key.enc");

export function keystoreExists(): boolean {
  return existsSync(KEYSTORE_PATH);
}

export function readKeystore(): EncryptedKeystore {
  return JSON.parse(readFileSync(KEYSTORE_PATH, "utf8"));
}

export function writeKeystore(ks: EncryptedKeystore): void {
  mkdirSync(dirname(KEYSTORE_PATH), { recursive: true });
  // 0o600 = rw for owner only; same default geth/web3 keystores use.
  writeFileSync(KEYSTORE_PATH, JSON.stringify(ks, null, 2), { mode: 0o600 });
}

/** Normalize and validate a user-typed private key. Tolerates a
 *  missing 0x prefix and uppercase hex. Throws on anything that isn't
 *  exactly 32 bytes of hex. */
export function normalizePrivateKey(input: string): `0x${string}` {
  const trimmed = input.trim().replace(/^0x/i, "").toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(trimmed)) {
    throw new Error("Invalid private key — must be 32 bytes (64 hex characters).");
  }
  return `0x${trimmed}` as `0x${string}`;
}

/** Encrypt + persist a brand-new keystore. Used by `wallet init`. */
export function persistKeystore(privateKey: `0x${string}`, password: string): EncryptedKeystore {
  const account = privateKeyToAccount(privateKey);
  const ks = encryptKeystore(privateKey, password, account.address);
  writeKeystore(ks);
  return ks;
}

/** Load + decrypt the keystore, returning a viem account ready to
 *  sign with. Prompts the user for the password (no echo) unless one
 *  is supplied programmatically — useful for tests. */
export async function loadAccount(opts?: { password?: string }): Promise<PrivateKeyAccount> {
  if (!keystoreExists()) {
    throw new Error(
      `No admin keystore at ${KEYSTORE_PATH}.\nRun \`pnpm admin wallet init\` to create one.`,
    );
  }
  const ks = readKeystore();
  const password = opts?.password ?? (await promptHidden("Keystore password: "));
  const pk = decryptKeystore(ks, password);
  return privateKeyToAccount(pk);
}
