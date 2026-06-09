/**
 * Stablecoin single-tx payment rail — dev smoke (slice F, 2026-06-09).
 *
 * Controlled, SAFE validation of the rail before the real MiniPay smoke
 * (slice G). This script:
 *   - NEVER sends a transaction.
 *   - NEVER uses a private key.
 *   - NEVER writes the ledger with dummy data (a dummy txHash fails closed
 *     at receipt fetch, long before any credit).
 *   - Defaults to dry-run (local config + pure builder only); the optional
 *     `--endpoint <url>` does a SAFE dummy probe of /api/verify-payment.
 *
 * Run:
 *   pnpm --filter web rail:smoke
 *   # to also probe a deployed endpoint (safe dummy txHash):
 *   pnpm --filter web rail:smoke -- --endpoint https://<preview-or-prod>
 *
 * Guardrail documented + relied on here: the rail accepts ONLY direct
 * `token.transfer(treasury, amount)` (receipt.to == ERC20 token). A Shop
 * purchase (receipt.to == Shop contract) is rejected, so a Shop payment
 * can't be replayed to double-credit Peones.
 */

import {
  getRailDefaultStablecoin,
  getTreasuryAddressClient,
  getTreasuryAddressServer,
  isRailTreasuryConfiguredClient,
  PEONES_PACKS,
} from "@/lib/payments/rail-config";
import { buildPeonesPackTransfer } from "@/lib/payments/transfer-builder";

const SKU = "peones_pack_50" as const;
const DUMMY_TX = `0x${"0".repeat(64)}`;
const DEMO_WALLET = "0x000000000000000000000000000000000000dEaD"; // input shape only

function mask(addr: string | null): string {
  if (!addr) return "UNSET";
  return `set (${addr.slice(0, 6)}…${addr.slice(-4)})`;
}

function line(s = "") {
  // eslint-disable-next-line no-console
  console.log(s);
}

function getEndpointArg(): string | null {
  const i = process.argv.indexOf("--endpoint");
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : null;
}

async function probeEndpoint(baseUrl: string): Promise<void> {
  const url = `${baseUrl.replace(/\/$/, "")}/api/verify-payment`;
  const token = getRailDefaultStablecoin().address;
  line(`5. Endpoint probe (SAFE dummy txHash — NOT a real purchase):`);
  line(`   POST ${url}`);
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ chainId: 42220, txHash: DUMMY_TX, wallet: DEMO_WALLET, token, sku: SKU }),
    });
  } catch (e) {
    line(`   ⚠️  request failed: ${(e as Error).message}`);
    return;
  }
  const json = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
  line(`   → HTTP ${res.status} ${JSON.stringify(json)}`);
  if (json.ok === true) {
    line(`   ❌ ALARM: endpoint returned ok:true for a DUMMY txHash — a real credit must never happen here.`);
    process.exitCode = 1;
  } else if (json.error === "rail_not_configured") {
    line(`   ⚠️  Server treasury NOT configured on that deploy (fail-closed working, env missing).`);
  } else if (json.error === "receipt_not_found" || json.error === "transfer_not_found") {
    line(`   ✓ Server treasury IS configured (passed fail-closed gate); dummy txHash safely rejected, no ledger write.`);
  } else {
    line(`   ✓ Controlled error (${json.error ?? "unknown"}); no ledger write for a dummy txHash.`);
  }
}

async function main(): Promise<void> {
  line("=== Stablecoin single-tx payment rail — dev smoke (dry-run) ===");

  // 1. Treasury config (reads LOCAL process.env — for the DEPLOYED env use --endpoint).
  const clientT = getTreasuryAddressClient();
  const serverT = getTreasuryAddressServer();
  line("1. Treasury config (local process.env):");
  line(`   client (NEXT_PUBLIC_CHESSCITO_TREASURY_ADDRESS): ${mask(clientT)}`);
  line(`   server (CHESSCITO_TREASURY_ADDRESS ?? TREASURY_ADDRESS): ${mask(serverT)}`);

  // 2. Fail-closed status.
  line("2. Fail-closed status (local):");
  line(`   client rail configured: ${isRailTreasuryConfiguredClient()}`);
  line(`   server fail-closed (would reject): ${serverT === null}`);

  // 3. Builder for peones_pack_50 (pure — no send). Uses the configured
  //    treasury; skipped if unset locally (no placeholder ever).
  line(`3. Builder (${SKU}, default ${getRailDefaultStablecoin().symbol}):`);
  const pack = PEONES_PACKS[SKU];
  line(`   pack: $${(Number(pack.priceUsd6) / 1e6).toFixed(2)} → ${pack.peonesReward} Peones, source ${pack.source}`);
  if (serverT) {
    const tx = buildPeonesPackTransfer({ sku: SKU, treasury: serverT });
    line(`   to (token): ${tx.to}`);
    line(`   value: ${tx.value} (native — always 0)`);
    line(`   expectedAmount: ${tx.expectedAmount} (${tx.token.symbol}, ${tx.token.decimals} dec)`);
    line(`   data: ${tx.data.slice(0, 10)}… (transfer selector + treasury + amount)`);
  } else {
    line(`   SKIPPED — treasury not set locally (no placeholder). Export the env or use --endpoint.`);
  }

  // 4-5. Endpoint check (opt-in; safe dummy).
  const endpoint = getEndpointArg();
  if (endpoint) {
    await probeEndpoint(endpoint);
  } else {
    line("4. Endpoint check: skipped (dry-run). Pass --endpoint <url> for a SAFE dummy probe.");
  }

  // 6-7. Safety reminders.
  line("6. Safety: this script NEVER sends a tx and uses NO private key.");
  line("7. Safety: a dummy txHash NEVER writes the ledger (fails closed at receipt fetch).");

  // Guardrail.
  line("Guardrail (anti-replay): /api/verify-payment requires receipt.to == ERC20 token");
  line("   → direct transfers only; Shop buyItem (receipt.to == Shop) rejected as not_direct_transfer.");

  // What's left for G.
  line("=== What's left for G (MiniPay real smoke) ===");
  line("   - A REAL MiniPay USDC transfer(treasury, 500000) from a real wallet (one tx, no approve).");
  line("   - The REAL txHash → POST /api/verify-payment → expect ok:true, 50 Peones credited.");
  line("   - Confirm gas charged as stablecoin (feeCurrency) + the Transfer event + idempotency.");
}

void main();
