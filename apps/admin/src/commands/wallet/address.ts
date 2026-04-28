import { defineCommand } from "citty";
import { privateKeyToAccount } from "viem/accounts";

import { decryptKeystore } from "@/lib/crypto";
import { promptHidden } from "@/lib/prompt";
import { keystoreExists, KEYSTORE_PATH, readKeystore } from "@/lib/wallet";

export default defineCommand({
  meta: {
    name: "address",
    description:
      "Show the admin wallet address. Reads the unencrypted address metadata by default; pass --verify to decrypt and confirm the metadata matches the actual key.",
  },
  args: {
    verify: {
      type: "boolean",
      default: false,
      description: "Prompt for the password and confirm the decrypted PK matches the stored address.",
    },
  },
  async run({ args }) {
    if (!keystoreExists()) {
      console.error(`No keystore at ${KEYSTORE_PATH}.`);
      console.error("Run `pnpm admin wallet init` first.");
      process.exitCode = 1;
      return;
    }
    const ks = readKeystore();
    console.log(`Keystore : ${KEYSTORE_PATH}`);
    console.log(`Address  : ${ks.address}`);
    console.log(`Created  : ${ks.createdAt}`);

    if (!args.verify) return;

    const password = await promptHidden("Keystore password: ");
    try {
      const pk = decryptKeystore(ks, password);
      const derived = privateKeyToAccount(pk).address;
      if (derived.toLowerCase() === ks.address.toLowerCase()) {
        console.log("Verified : decrypted PK matches the stored address ✓");
      } else {
        console.error("Verified : MISMATCH — decrypted PK derives to a different address!");
        console.error(`         decrypted address: ${derived}`);
        console.error(`         metadata address : ${ks.address}`);
        process.exitCode = 1;
      }
    } catch (err) {
      console.error(err instanceof Error ? err.message : String(err));
      process.exitCode = 1;
    }
  },
});
