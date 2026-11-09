import { keccak256, toBytes } from "viem";

export const GAME_WRITE_TTL_MS = 5 * 60 * 1000;
export const GAME_WRITE_MAX_BYTES = 64 * 1024;
export const GAME_WRITE_ISSUED_HEADER = "x-chesscito-game-write-issued-at";
export const GAME_WRITE_SIGNATURE_HEADER = "x-chesscito-game-write-signature";

/** Bind one exact payload to its owner, resource, action and expiry. */
export function buildGameWriteMessage(args: {
  origin: string; path: string; wallet: string; gameId: string; body: string; issuedAt: number;
}): string {
  return [
    "Save my Chesscito game record",
    `Origin: ${args.origin}`,
    "Chain: 42220",
    `Wallet: ${args.wallet.toLowerCase()}`,
    `Resource: POST ${args.path}`,
    `Game: ${args.gameId}`,
    `Payload: ${keccak256(toBytes(args.body))}`,
    `Issued: ${args.issuedAt}`,
    `Expires: ${args.issuedAt + GAME_WRITE_TTL_MS}`,
    "Save only this game payload. No blockchain transaction or payment authorized.",
  ].join("\n");
}
