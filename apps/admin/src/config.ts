/** Network + contract addresses used by the admin CLI. Keeps a tiny
 *  duplication with `apps/web/src/lib/contracts/chains.ts` for now —
 *  if either package keeps growing, the next step is extracting a
 *  shared `packages/contracts-config` workspace and importing from
 *  there. TODO once admin matures. */

export type Chain = "celo" | "celo-sepolia";

type ChainConfig = {
  /** EIP-155 chain id used when validating wallet connection. */
  chainId: number;
  /** Public RPC endpoint. Read-only — no API key required. */
  rpcUrl: string;
  /** Block explorer used to surface txHash links in the audit log. */
  explorer: string;
  contracts: {
    shop: `0x${string}`;
    victoryNFT: `0x${string}`;
    badges: `0x${string}`;
    scoreboard: `0x${string}`;
  };
  /** Native CELO token address (ERC-20 wrapper of the gas token).
   *  Not strictly a "contract address we own" but commands that
   *  whitelist / blacklist payment tokens reference it. */
  celoToken: `0x${string}`;
};

export const CHAINS: Record<Chain, ChainConfig> = {
  celo: {
    chainId: 42220,
    rpcUrl: "https://forno.celo.org",
    explorer: "https://celoscan.io",
    contracts: {
      shop: "0x24846C772af7233ADfD98b9A96273120f3a1f74b",
      victoryNFT: "0x0eE22F830a99e7a67079018670711C0F94Abeeb0",
      badges: "0xf92759E5525763554515DD25E7650f72204a6739",
      scoreboard: "0x1681aAA176d5f46e45789A8b18C8E990f663959a",
    },
    celoToken: "0x471EcE3750Da237f93B8E339c536989b8978a438",
  },
  "celo-sepolia": {
    chainId: 11142220,
    rpcUrl: "https://forno.celo-sepolia.celo-testnet.org",
    explorer: "https://celo-sepolia.blockscout.com",
    contracts: {
      shop: "0x0000000000000000000000000000000000000000",
      victoryNFT: "0x87cC9fe03E76A5894De2FE1372E85D6f5Bb922A9",
      badges: "0x0000000000000000000000000000000000000000",
      scoreboard: "0x0000000000000000000000000000000000000000",
    },
    celoToken: "0xf194afdf50b03e69bd7d057c1aa9e10c9954e4c9",
  },
};

export function resolveChain(input: string | undefined): Chain {
  if (input === "celo" || input === "celo-sepolia") return input;
  // Default to mainnet — admin operations almost always target prod.
  return "celo";
}

export function getChainConfig(chain: Chain): ChainConfig {
  return CHAINS[chain];
}
