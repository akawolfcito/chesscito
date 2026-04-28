import { defineCommand } from "citty";
import { isAddress, type AbiFunction, type Address } from "viem";

import { getChainConfig, resolveChain } from "@/config";
import { getPublicClient, readContract } from "@/lib/tx-runner";

const ACCEPTED_TOKENS_ABI: AbiFunction = {
  type: "function",
  name: "acceptedTokens",
  stateMutability: "view",
  inputs: [{ name: "", type: "address" }],
  // The mapping stores the token's decimals as uint8. A return of 0
  // means "not whitelisted"; anything in [6, 18] means "whitelisted
  // with that decimal count". See ShopUpgradeable.setAcceptedToken.
  outputs: [{ name: "", type: "uint8" }],
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
    description:
      "Read the Shop.acceptedTokens entry for a token. Returns the stored decimals (6-18) when whitelisted, or 0 when not.",
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
    const decimals = await readContract<number>(client, cfg.contracts.shop, ACCEPTED_TOKENS_ABI, [token]);

    console.log(`Shop ${cfg.contracts.shop} on ${chain}`);
    console.log(`  token       : ${token}${args.token.toUpperCase() === "CELO" ? " (CELO)" : ""}`);
    console.log(`  whitelisted : ${decimals !== 0}`);
    console.log(`  decimals    : ${decimals === 0 ? "—" : decimals.toString()}`);
  },
});
