/**
 * Verify that a Celo transaction carries Chesscito's ERC-8021 attribution.
 *
 *   pnpm -C apps/web attribution:verify 0x<txHash>
 *
 * Reads `NEXT_PUBLIC_CELO_ATTRIBUTION_TAG` from the environment, fetches the
 * transaction, decodes any attribution suffix with the official package, and
 * reports whether the marker is present and whether the code matches ours.
 *
 * ⛔ IT NEVER PRINTS A CODE — not the configured one, not the on-chain one, not
 * in an error path. Every output is a verdict: FOUND / NOT FOUND, MATCH /
 * MISMATCH, plus a count and a schema id. A script whose whole job is handling
 * a private identifier has no business echoing it, and "just for debugging" is
 * how it would end up in a terminal screenshot.
 *
 * ⚠️ READ-ONLY. It opens a public RPC and calls `eth_getTransactionByHash`.
 * It signs nothing, sends nothing and needs no key.
 */

import { createPublicClient, http } from "viem";
import { celo } from "viem/chains";
import { fromDataSuffix, toDataSuffix, verifyTx } from "@celo/attribution-tags";

const ENV_VAR = "NEXT_PUBLIC_CELO_ATTRIBUTION_TAG";

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

async function main() {
  const hash = process.argv[2];
  if (!hash || !/^0x[0-9a-fA-F]{64}$/.test(hash)) {
    fail(
      "Usage: pnpm -C apps/web attribution:verify 0x<64-hex-tx-hash>\n" +
        "Verifies that a Celo transaction carries Chesscito's attribution tag.",
    );
  }

  const configured = process.env[ENV_VAR]?.trim();
  let expectedSuffix: string | null = null;
  if (configured) {
    try {
      expectedSuffix = toDataSuffix(configured);
    } catch {
      // Shape only. The value that failed is never echoed.
      fail(`${ENV_VAR} is set but is not a valid attribution code.`);
    }
  }

  const client = createPublicClient({
    chain: celo,
    transport: http(process.env.CELO_RPC_URL || undefined),
  });

  const decoded = await verifyTx({ client, hash: hash as `0x${string}` });

  if (!decoded) {
    console.log("Attribution marker: NOT FOUND");
    console.log("  The transaction carries no ERC-8021 suffix.");
    process.exit(2);
  }

  console.log("Attribution marker: FOUND");
  console.log(`  schemaId: ${decoded.schemaId}`);
  console.log(`  codes carried: ${decoded.codes.length}`);

  if (!configured) {
    console.log(`Configured Chesscito tag: NOT SET (${ENV_VAR} is empty)`);
    console.log("  Cannot compare. Set it in the environment and re-run.");
    process.exit(3);
  }

  /* ⛔ Compared as ENCODED SUFFIXES, so neither side has to be printed and a
     casing or whitespace difference cannot produce a false MISMATCH. */
  const ours = decoded.codes.some((code) => {
    try {
      return toDataSuffix(code) === expectedSuffix;
    } catch {
      return false;
    }
  });

  console.log(`Configured Chesscito tag: ${ours ? "MATCH" : "MISMATCH"}`);
  if (!ours) {
    console.log("  The suffix is present but belongs to a different code.");
    // Sanity signal that does not reveal anything: is the suffix even ours in
    // shape? `fromDataSuffix` round-trips what verifyTx already gave us.
    const roundTrip = fromDataSuffix(expectedSuffix as `0x${string}`);
    console.log(`  (our tag encodes ${roundTrip?.codes.length ?? 0} code)`);
    process.exit(4);
  }

  console.log("OK — this transaction is attributed to Chesscito.");
}

main().catch((error: unknown) => {
  // Never interpolate anything that could carry the configured value.
  fail(`Verification failed: ${error instanceof Error ? error.message : "unknown error"}`);
});
