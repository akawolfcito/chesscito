/**
 * Send ONE inbox message to ONE wallet. Operational, manual, deliberate.
 *
 *   pnpm -C apps/web exec tsx ../../scripts/ops/send-inbox-message.ts <file.json>
 *   … --dry-run   Print what would be written and exit without writing.
 *
 * ⛔ THE RECIPIENT NEVER LIVES IN THIS REPO. The repo is public, so the wallet
 * comes from a JSON file the operator points at — by convention something under
 * `private/`, which is gitignored. Nothing here hardcodes an address, and the
 * script refuses to run without a file.
 *
 * ⛔ NOT A MIGRATION, and not a seed. A migration is code everybody runs; this
 * message belongs to one person and is sent once, by hand, on purpose.
 *
 * Input file shape:
 *   {
 *     "wallet": "0x…",
 *     "type": "milestone",
 *     "title": "10 Focus Days 🔥",
 *     "body":  "Thanks for coming back.\n\n…",
 *     "ctaLabel": null,
 *     "ctaHref": null
 *   }
 *
 * Spec: docs/specs/2026-08-25-inbox-v0-review.md
 */

import { readFileSync } from "node:fs";
import path from "node:path";

import { createClient } from "@supabase/supabase-js";

import { loadOpsEnv } from "./lib/env";

const TYPES = ["announcement", "achievement", "gift", "milestone"] as const;
type MessageType = (typeof TYPES)[number];

type Input = {
  wallet: string;
  type: MessageType;
  title: string;
  body: string;
  ctaLabel?: string | null;
  ctaHref?: string | null;
};

/** Shows enough of an address to confirm it, never the whole thing. */
function maskWallet(wallet: string): string {
  return `${wallet.slice(0, 6)}…${wallet.slice(-4)}`;
}

function parseInput(file: string): Input {
  const raw = JSON.parse(readFileSync(file, "utf8")) as Partial<Input>;

  if (typeof raw.wallet !== "string" || !/^0x[0-9a-fA-F]{40}$/.test(raw.wallet)) {
    throw new Error("wallet must be a 0x-prefixed 40-hex address");
  }
  if (!raw.type || !(TYPES as readonly string[]).includes(raw.type)) {
    throw new Error(`type must be one of: ${TYPES.join(", ")}`);
  }
  if (!raw.title?.trim()) throw new Error("title is required");
  if (!raw.body?.trim()) throw new Error("body is required");

  /* ⛔ A CTA LABEL WITHOUT A DESTINATION IS A PROMISE THE UI CANNOT KEEP. The
   * first real message deliberately ships with NO cta at all: the claim does not
   * exist yet, and a button that goes nowhere is worse than no button. */
  if (raw.ctaLabel && !raw.ctaHref) {
    throw new Error("ctaLabel without ctaHref: a button that goes nowhere");
  }

  return {
    wallet: raw.wallet.toLowerCase(),
    type: raw.type,
    title: raw.title,
    body: raw.body,
    ctaLabel: raw.ctaLabel ?? null,
    ctaHref: raw.ctaHref ?? null,
  };
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const file = args.find((a) => !a.startsWith("--"));

  if (!file) {
    console.error(
      "usage: send-inbox-message.ts <file.json> [--dry-run]\n" +
        "       the file carries the recipient; keep it under private/",
    );
    process.exit(2);
  }

  const input = parseInput(path.resolve(file));

  console.log("about to send:");
  console.log(`  wallet : ${maskWallet(input.wallet)}`);
  console.log(`  type   : ${input.type}`);
  console.log(`  title  : ${input.title}`);
  console.log(`  cta    : ${input.ctaLabel ?? "(none)"}`);
  console.log(`  body   : ${input.body.length} chars`);

  if (dryRun) {
    console.log("\n--dry-run: nothing written.");
    return;
  }

  // `loadOpsEnv` takes the repo root and returns a getter — same accessor the
  // health monitor uses. Credentials travel in memory, never through argv.
  const env = loadOpsEnv(path.resolve(__dirname, "..", ".."));
  const url = env.get("SUPABASE_URL");
  const key = env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) {
    console.error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not configured");
    process.exit(1);
  }

  const supabase = createClient(url, key, {
    auth: { persistSession: false },
  });

  const { data, error } = await supabase
    .from("inbox_messages")
    .insert({
      wallet: input.wallet,
      type: input.type,
      title: input.title,
      body: input.body,
      cta_label: input.ctaLabel,
      cta_href: input.ctaHref,
    })
    .select("id");

  if (error) {
    // Never echo the Supabase message: it can quote the offending row.
    console.error("insert failed");
    process.exit(1);
  }

  console.log(`\nsent. message id: ${data?.[0]?.id ?? "(unknown)"}`);
}

main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.message : "failed");
  process.exit(1);
});
