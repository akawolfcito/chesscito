import { parseSignature } from "viem";

/**
 * Split a 65-byte EIP-2612 permit signature into `{ v, r, s }` for the
 * contract's `permit(owner, spender, value, deadline, v, r, s)` call.
 *
 * Wallets encode the recovery byte either as legacy 27/28 or as raw
 * yParity 0/1 (EIP-2098-style — MiniPay among them). viem's
 * `parseSignature` leaves `v` undefined for the 0/1 form, so it must be
 * derived from `yParity`. Submitting v=0 makes ecrecover return a
 * garbage signer, the token's permit() reverts, and — because
 * VictoryNFT wraps permit() in try/catch — the mint tx dies later at
 * transferFrom during gas estimation, so it never reaches the chain.
 */
export function permitSignatureToVRS(signature: `0x${string}`): {
  v: number;
  r: `0x${string}`;
  s: `0x${string}`;
} {
  const parsed = parseSignature(signature);
  const v = parsed.v !== undefined ? Number(parsed.v) : parsed.yParity + 27;
  return { v, r: parsed.r, s: parsed.s };
}
