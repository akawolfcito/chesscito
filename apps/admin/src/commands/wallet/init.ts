import { defineCommand } from "citty";

import { promptHidden } from "@/lib/prompt";
import { keystoreExists, KEYSTORE_PATH, normalizePrivateKey, persistKeystore } from "@/lib/wallet";

export default defineCommand({
  meta: {
    name: "init",
    description:
      "Encrypt + store an admin private key locally. Prompts for the PK and a password (no echo) and writes apps/admin/.private/admin-key.enc.",
  },
  args: {
    force: {
      type: "boolean",
      default: false,
      description: "Overwrite an existing keystore at the canonical path",
    },
  },
  async run({ args }) {
    if (keystoreExists() && !args.force) {
      console.error(`A keystore already exists at ${KEYSTORE_PATH}.`);
      console.error("Pass --force to overwrite, or delete the file manually first.");
      process.exitCode = 1;
      return;
    }

    console.log("Importing a private key into the local admin keystore.");
    console.log("- Both prompts are no-echo. The PK never touches disk in plaintext.");
    console.log("- The encrypted file lives at apps/admin/.private/admin-key.enc (gitignored).");
    console.log("");

    const rawPk = await promptHidden("Private key (with or without 0x prefix): ");
    let pk: `0x${string}`;
    try {
      pk = normalizePrivateKey(rawPk);
    } catch (err) {
      console.error(err instanceof Error ? err.message : String(err));
      process.exitCode = 1;
      return;
    }

    const password = await promptHidden("New keystore password: ");
    if (password.length < 12) {
      console.error("Refusing to encrypt with a password shorter than 12 characters.");
      process.exitCode = 1;
      return;
    }
    const confirmPassword = await promptHidden("Confirm keystore password: ");
    if (password !== confirmPassword) {
      console.error("Passwords do not match. Aborting; nothing was written.");
      process.exitCode = 1;
      return;
    }

    const ks = persistKeystore(pk, password);
    console.log("");
    console.log(`Keystore written: ${KEYSTORE_PATH}`);
    console.log(`Address          : ${ks.address}`);
    console.log("");
    console.log("Verify any time with:");
    console.log("  pnpm admin wallet address");
  },
});
