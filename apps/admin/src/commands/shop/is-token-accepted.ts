import { defineCommand } from "citty";
import { isAddress, type AbiFunction, type Address } from "viem";

import { getChainConfig, resolveChain } from "@/config";
import { getPublicClient, readContract } from "@/lib/tx-runner";

const ACCEPTED_TOKENS_ABI: AbiFunction = {
  type: "function",
  name: "acceptedTokens",
  stateMutability: "view",
  inputs: [{ name: "", type: "address" }],
  outputs: [{ name: "", type: "bool" }],
};

function resolveTokenAlias(input: string, chainCelo: Address): Address {
  if (input.toUpperCase() === "CELO") return chainCelo;
  if (!isAddress(input)) {
    throw new Error(`Invalid token argument: "${input}". Pass an address or "CELO".`);
  }
  return input;
}

export default defineCommand({
  meta: {
    name: "is-token-accepted",
    description: "Read whether a token is whitelisted in Shop.acceptedTokens.",
  },
  args: {
    token: { type: "string", required: true, description: "ERC-20 address or alias (CELO)" },
    chain: { type: "string", default: "celo" },
  },
  async run({ args }) {
    const chain = resolveChain(args.chain);
    const cfg = getChainConfig(chain);
    const token = resolveTokenAlias(args.token, cfg.celoToken);

    const client = getPublicClient(cfg.rpcUrl);
    const accepted = await readContract<boolean>(client, cfg.contracts.shop, ACCEPTED_TOKENS_ABI, [token]);

    console.log(`Shop ${cfg.contracts.shop} on ${chain}`);
    console.log(`  token    : ${token}${args.token.toUpperCase() === "CELO" ? " (CELO)" : ""}`);
    console.log(`  accepted : ${accepted}`);
  },
});
