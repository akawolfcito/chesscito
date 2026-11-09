#!/usr/bin/env node
// Generates a single ABI fragment holding every custom error declared by the
// contracts a player's wallet actually calls, so `decodeErrorResult` can turn
// revert data into an error NAME instead of a shrug.
//
// Sibling of generate-event-abis.mjs, and for the same reason: a hand-written
// ABI drifts from the source in silence. A selector is 4 bytes of a keccak
// hash — nobody reviews a typo in one.
//
// Run after `pnpm --filter hardhat build`:
//   pnpm --filter hardhat generate:error-abis
//
// Output: apps/web/src/lib/contracts/generated/contract-errors.ts
//
// Adding another contract: extend CONTRACTS below. Only add contracts the
// PLAYER's wallet sends transactions to — this ABI ships in the client bundle.

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "../../..");

const OUTPUT = "apps/web/src/lib/contracts/generated/contract-errors.ts";

/** The four contracts a player transacts with. Treasury and the legacy
 *  non-upgradeable Shop are omitted: no player-signed call reaches them, so
 *  their errors can never land in a player's error toast. */
const CONTRACTS = [
  "apps/contracts/artifacts/contracts/BadgesUpgradeable.sol/BadgesUpgradeable.json",
  "apps/contracts/artifacts/contracts/ScoreboardUpgradeable.sol/ScoreboardUpgradeable.json",
  "apps/contracts/artifacts/contracts/VictoryNFTUpgradeable.sol/VictoryNFTUpgradeable.json",
  "apps/contracts/artifacts/contracts/ShopUpgradeable.sol/ShopUpgradeable.json",
];

/** `InvalidSignature()`, `NonceUsed(address,uint256)`. Two contracts declaring
 *  the identical error produce the identical selector, so the signature — not
 *  the name — is the dedupe key. Parameter NAMES are excluded on purpose: they
 *  don't enter the selector, and `QuantityExceedsMax(uint256 max)` vs
 *  `(uint256 maxQuantity)` are the same error to the EVM. */
function signatureOf(error) {
  return `${error.name}(${error.inputs.map((input) => input.type).join(",")})`;
}

function emitInput(input) {
  return `      { name: ${JSON.stringify(input.name)}, type: ${JSON.stringify(input.type)} },`;
}

function emitErrorAbi(error) {
  const inputs = error.inputs.length === 0
    ? `    inputs: [],`
    : [`    inputs: [`, ...error.inputs.map(emitInput), `    ],`].join("\n");
  return [
    `  {`,
    `    type: "error",`,
    `    name: ${JSON.stringify(error.name)},`,
    inputs,
    `  },`,
  ].join("\n");
}

const bySignature = new Map();

for (const artifact of CONTRACTS) {
  const json = JSON.parse(readFileSync(resolve(REPO_ROOT, artifact), "utf8"));
  const errors = json.abi.filter((item) => item.type === "error");
  if (errors.length === 0) {
    throw new Error(`No custom errors found in artifact: ${artifact}`);
  }
  for (const error of errors) {
    bySignature.set(signatureOf(error), error);
  }
}

// Sorted so a recompile that reorders the artifact doesn't churn the diff.
const errors = [...bySignature.entries()]
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([, error]) => error);

const header = [
  `// AUTO-GENERATED — DO NOT EDIT BY HAND.`,
  `// Sources:`,
  ...CONTRACTS.map((artifact) => `//   ${artifact}`),
  `// Regenerate: pnpm --filter hardhat generate:error-abis`,
  `//`,
  `// Every custom error the four player-facing contracts can revert with, as one`,
  `// ABI fragment for viem's decodeErrorResult(). Selectors are derived by viem`,
  `// from these signatures at call time — none are written down, so none can rot.`,
  `//`,
  `// Being in here does NOT give an error player-facing copy. This is the`,
  `// vocabulary; lib/errors.ts decides which words the player is shown.`,
  ``,
  `/* eslint-disable */`,
  ``,
].join("\n");

const body = [`export const CONTRACT_ERRORS_ABI = [`, ...errors.map(emitErrorAbi), `] as const;`].join(
  "\n",
);

const outputPath = resolve(REPO_ROOT, OUTPUT);
mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, `${header}${body}\n`);
console.log(`✓ ${errors.length} custom error(s) from ${CONTRACTS.length} contract(s) → ${OUTPUT}`);
