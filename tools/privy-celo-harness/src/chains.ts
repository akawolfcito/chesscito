import { celo, celoSepolia } from "wagmi/chains";

// First-class viem/wagmi chain objects — never hand-declared. These mirror the
// productive Chesscito stack (apps/web WalletProvider uses [celo, celoSepolia])
// but are imported here independently; no productive module is touched.

/** The ONLY chain this harness ever broadcasts on. Celo testnet (Sepolia). */
export const SEND_CHAIN = celoSepolia;

/** Mainnet is listed as supported/visible but NEVER used to send value. */
export const MAINNET_CHAIN = celo;

/** Both chains are configured so the wallet can *see* mainnet, but sends are
 *  guarded to testnet only (see assertTestnetForSend). */
export const SUPPORTED_CHAINS = [celoSepolia, celo] as const;

export const SEND_CHAIN_ID = celoSepolia.id; // 11142220
export const MAINNET_CHAIN_ID = celo.id; //     42220
