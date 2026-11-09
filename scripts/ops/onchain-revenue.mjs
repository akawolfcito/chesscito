#!/usr/bin/env node
/**
 * Read-only audit of what actually happened ON CHAIN, since a date you choose.
 *
 *   node scripts/ops/onchain-revenue.mjs
 *   node scripts/ops/onchain-revenue.mjs --since 2026-08-03
 *   CELO_RPC=https://... node scripts/ops/onchain-revenue.mjs --since 2026-08-03
 *
 * **Why this exists.** `/stats` counts money from Supabase tables that MIRROR
 * on-chain events (`peones_ledger`, `victories`, `scores`). Those rows are what
 * the app managed to WRITE — during the database outage it wrote nothing, so
 * every money figure on that page is a floor. The chain has no such gap, and
 * this script reads it directly.
 *
 * **Why a date filter is not a nicety.** Before the MiniPay listing on
 * 2026-08-03 the only wallet touching these contracts was the founder's, doing
 * development and tests. Counting from deployment mixes those in and inflates
 * every number. `--since` is the difference between "what the product did" and
 * "what we did to the product".
 *
 * ⚠️ **Public Celo RPCs cap `eth_getLogs` at ~1,000 blocks** (measured across
 * Forno, dRPC, 1rpc, OnFinality and Ankr — 10k already fails). At ~1s blocks
 * that is ~17 minutes of chain per call, so a scan since deployment would need
 * ~13,000 requests and is not attempted here. A recent `--since` is cheap; an
 * old one is slow. For the full history use an explorer API key or an indexer.
 *
 * ⛔ Read-only: no keys, no signing, no writes. Nothing here touches the
 * published page.
 */

import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";

// ⚠️ `viem` is a dependency of `apps/web`, not of the repo root, and pnpm does
// not hoist it — a plain `import … from "viem"` here fails with
// ERR_MODULE_NOT_FOUND because ESM resolves against THIS file's path, not the
// working directory. Resolving through the web package keeps this script
// dependency-free at the root instead of adding a duplicate pin.
const requireFromWeb = createRequire(new URL("../../apps/web/package.json", import.meta.url));
const { createPublicClient, http, parseAbiItem, formatUnits } = await import(
  pathToFileURL(requireFromWeb.resolve("viem")).href
);

const args = process.argv.slice(2);
const sinceArg = args.includes("--since") ? args[args.indexOf("--since") + 1] : "2026-08-03";
/** The MiniPay listing. Everything before it is development traffic. */
const SINCE_MS = Date.parse(sinceArg.length === 10 ? `${sinceArg}T00:00:00Z` : sinceArg);
if (!Number.isFinite(SINCE_MS)) {
  console.error(`Unparseable --since: ${sinceArg}`);
  process.exit(1);
}

const CHUNK = 1000n;
const CONCURRENCY = 12;

const client = createPublicClient({
  transport: http(process.env.CELO_RPC ?? "https://forno.celo.org", {
    timeout: 30_000,
    retryCount: 3,
  }),
});

/** Celo mainnet, from `apps/contracts/deployments/celo.json`. */
const SOURCES = [
  {
    name: "Get Peones purchases",
    address: "0x24846C772af7233ADfD98b9A96273120f3a1f74b",
    event: parseAbiItem(
      "event ItemPurchased(address indexed buyer, uint256 indexed itemId, uint256 quantity, uint256 unitPriceUsd6, uint256 totalTokenAmount, address indexed token, address treasury)",
    ),
    wallet: "buyer",
    amount: "totalTokenAmount",
    itemised: true,
  },
  {
    name: "Victory mints (paid)",
    address: "0x0eE22F830a99e7a67079018670711C0F94Abeeb0",
    event: parseAbiItem(
      "event VictoryMinted(address indexed player, uint256 indexed tokenId, uint8 difficulty, uint16 totalMoves, uint32 timeMs, address indexed token, uint256 totalAmount)",
    ),
    wallet: "player",
    amount: "totalAmount",
  },
  {
    name: "Scores submitted (free)",
    address: "0x1681aAA176d5f46e45789A8b18C8E990f663959a",
    event: parseAbiItem(
      "event ScoreSubmitted(address indexed player, uint256 indexed levelId, uint256 score, uint256 timeMs, uint256 nonce, uint256 deadline)",
    ),
    wallet: "player",
    amount: null,
  },
];

const TOKENS = {
  "0xceba9300f2b948710d2653dd7b07f33a8b32118c": { symbol: "USDC", decimals: 6 },
  "0x48065fbbe25f71c9282ddf5e1cd6d6a887483d5e": { symbol: "USDT", decimals: 6 },
  "0x765de816845861e75a25fca122bb6898b8b1282a": { symbol: "cUSD", decimals: 18 },
};

/** Binary search for the first block at or after `targetMs`. ⚠️ NOT derived
 *  from an average block time: that drifts by hours over a few months. */
async function blockAt(targetMs, latest) {
  let lo = 0n;
  let hi = latest;
  while (lo < hi) {
    const mid = (lo + hi) / 2n;
    const block = await client.getBlock({ blockNumber: mid });
    if (Number(block.timestamp) * 1000 < targetMs) lo = mid + 1n;
    else hi = mid;
  }
  return lo;
}

async function pooled(tasks, limit) {
  const out = [];
  let next = 0;
  await Promise.all(
    Array.from({ length: limit }, async () => {
      while (next < tasks.length) {
        const i = next++;
        out[i] = await tasks[i]();
      }
    }),
  );
  return out;
}

const latest = await client.getBlockNumber();
const from = await blockAt(SINCE_MS, latest);
const ranges = [];
for (let start = from; start <= latest; start += CHUNK) {
  ranges.push([start, start + CHUNK - 1n > latest ? latest : start + CHUNK - 1n]);
}

console.log(
  `Chesscito on-chain audit\n` +
    `  since    ${new Date(SINCE_MS).toISOString()} (block ${from})\n` +
    `  latest   ${latest}\n` +
    `  window   ${latest - from} blocks · ${ranges.length} calls per contract\n`,
);

const walletsSeen = new Set();

for (const src of SOURCES) {
  const chunks = await pooled(
    ranges.map(([a, b]) => async () => {
      try {
        return await client.getLogs({
          address: src.address,
          event: src.event,
          fromBlock: a,
          toBlock: b,
        });
      } catch {
        // A failed chunk is reported, never silently treated as "no activity":
        // an undercount that looks like a zero is the whole defect this file
        // exists to avoid.
        return "ERROR";
      }
    }),
    CONCURRENCY,
  );

  const failed = chunks.filter((c) => c === "ERROR").length;
  const logs = chunks.filter((c) => c !== "ERROR").flat();
  const wallets = new Set(logs.map((l) => String(l.args[src.wallet]).toLowerCase()));
  for (const w of wallets) walletsSeen.add(w);

  console.log(`=== ${src.name} ===`);
  console.log(`  events   ${logs.length}${failed ? `   ⚠️ ${failed}/${ranges.length} chunks FAILED — this is a floor` : ""}`);
  console.log(`  wallets  ${wallets.size}`);

  if (src.amount && logs.length > 0) {
    const byToken = {};
    for (const l of logs) {
      const t = TOKENS[String(l.args.token).toLowerCase()];
      const key = t?.symbol ?? String(l.args.token);
      byToken[key] =
        (byToken[key] ?? 0) + Number(formatUnits(l.args[src.amount] ?? 0n, t?.decimals ?? 18));
    }
    console.log(
      `  volume   ${Object.entries(byToken)
        .map(([k, v]) => `${v.toFixed(4)} ${k}`)
        .join(" · ")}`,
    );

    const blocks = [...new Set(logs.map((l) => l.blockNumber))];
    const times = new Map(
      await pooled(
        blocks.map((b) => async () => [
          b,
          Number((await client.getBlock({ blockNumber: b })).timestamp) * 1000,
        ]),
        CONCURRENCY,
      ),
    );
    const byDay = {};
    for (const l of logs) {
      const day = new Date(times.get(l.blockNumber)).toISOString().slice(0, 10);
      byDay[day] = (byDay[day] ?? 0) + 1;
    }
    console.log(`  by day   ${Object.entries(byDay).map(([d, n]) => `${d}: ${n}`).join(" · ")}`);

    if (src.itemised) {
      const items = {};
      for (const l of logs) {
        const id = String(l.args.itemId);
        items[id] = (items[id] ?? 0) + Number(l.args.quantity ?? 0n);
      }
      console.log(`  items    ${Object.entries(items).map(([i, q]) => `#${i} ×${q}`).join(" · ")}`);
    }
  }
  console.log("");
}

console.log(`=== TOTAL ===\n  distinct wallets on chain since ${sinceArg}: ${walletsSeen.size}`);
