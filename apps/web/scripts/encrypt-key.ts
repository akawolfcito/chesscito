import { createInterface } from "node:readline/promises";
import { randomBytes } from "node:crypto";
import { stdin, stdout } from "node:process";

// Inline encrypt to avoid import path issues when running standalone
import { createCipheriv } from "node:crypto";

const ALGO = "aes-256-gcm";
const IV_BYTES = 12;

function encrypt(plainKey: string, passphrase: string): string {
  if (!/^[0-9a-fA-F]{64}$/.test(passphrase)) {
    throw new Error("Passphrase must be exactly 64 hex characters (32 bytes)");
  }
  const iv = randomBytes(IV_BYTES);
  const key = Buffer.from(passphrase, "hex");
  const cipher = createCipheriv(ALGO, key, iv);
  const encrypted = Buffer.concat([cipher.update(plainKey, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted.toString("hex")}`;
}

async function main() {
  const rl = createInterface({ input: stdin, output: stdout });

  try {
    const privateKey = await rl.question("Enter private key: ");
    if (!privateKey.trim()) {
      console.error("Error: empty input");
      process.exit(1);
    }

    const passphrase = randomBytes(32).toString("hex");
    const encrypted = encrypt(privateKey.trim(), passphrase);

    console.log("\n--- Add to .env ---");
    console.log(`TORRE_PRINCESA=${encrypted}`);
    console.log("\n--- Add to Vercel ONLY ---");
    console.log(`DRAGON=${passphrase}`);
    console.log("\n⚠️  Copy values now. Never persist DRAGON locally.");
    console.log("⚠️  Clear terminal after: clear or history -c");
    console.log("⚠️  Never pipe, redirect, screenshot, or share this output.");
  } finally {
    rl.close();
  }
}

main();
