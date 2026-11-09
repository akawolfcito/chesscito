import { defineCommand } from "citty";
import { type AbiFunction } from "viem";

import { getChainConfig, resolveChain } from "@/config";
import { getPublicClient, readContract } from "@/lib/tx-runner";

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

export default defineCommand({
  meta: {
    name: "get-item",
    description: "Read priceUsd6 + enabled flag for a Shop itemId.",
  },
  args: {
    "item-id": {
      type: "string",
      required: true,
      description: "Shop item id (integer)",
    },
    chain: {
      type: "string",
      default: "celo",
      description: "Target chain (celo | celo-sepolia)",
    },
  },
  async run({ args }) {
    const chain = resolveChain(args.chain);
    const cfg = getChainConfig(chain);
    const itemId = BigInt(args["item-id"]);

    const client = getPublicClient(cfg.rpcUrl);
    const result = await readContract<readonly [bigint, boolean]>(
      client,
      cfg.contracts.shop,
      GET_ITEM_ABI,
      [itemId],
    );

    const [priceUsd6, enabled] = result;
    const priceUsd = Number(priceUsd6) / 1_000_000;

    console.log(`Shop ${cfg.contracts.shop} on ${chain}`);
    console.log(`  itemId    : ${itemId.toString()}`);
    console.log(`  priceUsd6 : ${priceUsd6.toString()} ($${priceUsd.toFixed(6)})`);
    console.log(`  enabled   : ${enabled}`);
  },
});
