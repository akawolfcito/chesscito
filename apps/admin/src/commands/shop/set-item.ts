import { defineCommand } from "citty";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { type AbiFunction } from "viem";

import { getChainConfig, resolveChain } from "@/config";
import { getPublicClient, readContract, runWriteCommand } from "@/lib/tx-runner";
import { loadAccount } from "@/lib/wallet";

const SET_ITEM_ABI: AbiFunction = {
  type: "function",
  name: "setItem",
  stateMutability: "nonpayable",
  inputs: [
    { name: "itemId", type: "uint256" },
    { name: "priceUsd6", type: "uint256" },
    { name: "enabled", type: "bool" },
  ],
  outputs: [],
};

const GET_ITEM_ABI: AbiFunction = {
  type: "function",
  name: "getItem",
  stateMutability: "view",
  inputs: [{ name: "itemId", type: "uint256" }],
  outputs: [
    { name: "priceUsd6", type: "uint256" },
    { name: "enabled", type: "bool" },
  ],
};

const __dirname = dirname(fileURLToPath(import.meta.url));
const AUDIT_ROOT = join(__dirname, "..", "..", "..");

export default defineCommand({
  meta: {
    name: "set-item",
    description: "Configure a Shop item (priceUsd6 + enabled). Owner-only.",
  },
  args: {
    "item-id": { type: "string", required: true, description: "Shop item id (integer)" },
    "price-usd6": { type: "string", required: true, description: "Price in USD6 micro-units (e.g. 100000 = $0.10)" },
    enabled: { type: "boolean", required: true, description: "Whether the item is purchasable" },
    chain: { type: "string", default: "celo", description: "celo | celo-sepolia" },
    "dry-run": { type: "boolean", default: false, description: "Simulate only; do not broadcast" },
    yes: { type: "boolean", default: false, description: "Skip the y/N confirmation prompt" },
  },
  async run({ args }) {
    const chain = resolveChain(args.chain);
    const cfg = getChainConfig(chain);
    const itemId = BigInt(args["item-id"]);
    const priceUsd6 = BigInt(args["price-usd6"]);
    const enabled = Boolean(args.enabled);
    const dryRun = Boolean(args["dry-run"]);

    const client = getPublicClient(cfg.rpcUrl);
    const account = await loadAccount();

    const result = await runWriteCommand({
      command: "shop set-item",
      chain,
      contract: cfg.contracts.shop,
      abiItem: SET_ITEM_ABI,
      args: [itemId, priceUsd6, enabled],
      signature: "setItem(uint256,uint256,bool)",
      account,
      rpcUrl: cfg.rpcUrl,
      chainId: cfg.chainId,
      dryRun,
      yes: Boolean(args.yes),
      auditRoot: AUDIT_ROOT,
      preState: async () => {
        const [price, en] = await readContract<readonly [bigint, boolean]>(
          client,
          cfg.contracts.shop,
          GET_ITEM_ABI,
          [itemId],
        );
        return `(${price.toString()}, ${en})`;
      },
      postState: async () => {
        const [price, en] = await readContract<readonly [bigint, boolean]>(
          client,
          cfg.contracts.shop,
          GET_ITEM_ABI,
          [itemId],
        );
        return `(${price.toString()}, ${en})`;
      },
    });

    if (!result.ok) process.exitCode = 1;
  },
});
