#!/usr/bin/env node
// Generates per-event TypeScript ABI fragments from Hardhat artifacts so
// route handlers in apps/web stop hand-writing them — the verify-pro
// hot-fix in 4c8748f and the coach-verify hot-fix in 4ecca3c were both
// caused by hand-written ABIs drifting from the contract source. Output
// is committed for the same reason: PR diffs surface drift.
//
// Run after `pnpm --filter hardhat build`:
//   pnpm --filter hardhat generate:event-abis
//
// Output: apps/web/src/lib/contracts/generated/<contract>-events.ts
//
// Adding another contract: extend CONTRACTS below.

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "../../..");

const CONTRACTS = [
  {
    artifact: "apps/contracts/artifacts/contracts/ShopUpgradeable.sol/ShopUpgradeable.json",
    output: "apps/web/src/lib/contracts/generated/shop-events.ts",
    contractName: "ShopUpgradeable",
  },
];

/** ItemPurchased → ITEM_PURCHASED. */
function toUpperSnake(name) {
  return name.replace(/([a-z0-9])([A-Z])/g, "$1_$2").toUpperCase();
}

/** Emit a literal TS object so `as const` infers narrow types. JSON.stringify
 *  would inline true/false correctly but quoted strings need `as const` at the
 *  array level — easier to hand-format and keep readable. */
function emitInput(input) {
  const indexedLine = input.indexed === undefined ? "" : `, indexed: ${input.indexed}`;
  return `      { name: ${JSON.stringify(input.name)}, type: ${JSON.stringify(input.type)}${indexedLine} },`;
}

function emitEventAbi(event) {
  const inputsLines = event.inputs.map(emitInput).join("\n");
  return [
    `export const ${toUpperSnake(event.name)}_ABI = [`,
    `  {`,
    `    type: "event",`,
    `    name: ${JSON.stringify(event.name)},`,
    `    inputs: [`,
    inputsLines,
    `    ],`,
    `  },`,
    `] as const;`,
  ].join("\n");
}

function generate({ artifact, output, contractName }) {
  const artifactPath = resolve(REPO_ROOT, artifact);
  const outputPath = resolve(REPO_ROOT, output);

  const json = JSON.parse(readFileSync(artifactPath, "utf8"));
  const events = json.abi.filter((item) => item.type === "event");
  if (events.length === 0) {
    throw new Error(`No events found in artifact: ${artifactPath}`);
  }

  const header = [
    `// AUTO-GENERATED — DO NOT EDIT BY HAND.`,
    `// Source: ${artifact}`,
    `// Regenerate: pnpm --filter hardhat generate:event-abis`,
    `//`,
    `// Each export is a single-event ABI fragment ready to pass to viem's`,
    `// decodeEventLog({ abi: <FRAGMENT>, ... }). Field names mirror the`,
    `// contract source — viem decodes positionally so renames in the .sol`,
    `// surface as TypeScript errors at consumer destructure sites, which is`,
    `// exactly the signal we want.`,
    ``,
    `/* eslint-disable */`,
    ``,
  ].join("\n");

  const body = events.map(emitEventAbi).join("\n\n");
  const out = `${header}${body}\n`;

  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, out);
  console.log(`✓ ${contractName}: ${events.length} event(s) → ${output}`);
}

for (const cfg of CONTRACTS) {
  generate(cfg);
}
