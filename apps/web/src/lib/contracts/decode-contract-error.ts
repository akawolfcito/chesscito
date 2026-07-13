import { decodeErrorResult } from "viem";

import { CONTRACT_ERRORS_ABI } from "./generated/contract-errors";

/** Turns raw revert data into the NAME of the custom error that produced it,
 *  matching the 4-byte selector against the ABI generated from artifacts.
 *
 *  Returns `null` — never throws — for anything it cannot read: unknown
 *  selector, truncated data, a message format that changed under us, garbage.
 *  Callers treat `null` as "an ordinary revert" and show the copy they always
 *  showed. This module can only ever make an error message BETTER; it is not
 *  allowed to be the reason a screen breaks.
 *
 *  Being decodable does not make an error player-facing. `lib/errors.ts` picks
 *  which names earn their own words; everything else stays generic. */
export function decodeContractErrorName(data: string | null | undefined): string | null {
  if (!data || !data.startsWith("0x") || data.length < 10) return null;

  try {
    const { errorName } = decodeErrorResult({
      abi: CONTRACT_ERRORS_ABI,
      data: data as `0x${string}`,
    });
    return errorName ?? null;
  } catch {
    // Expected, not exceptional: an unknown selector is the common case (53
    // errors are declared, 5 have copy) and viem signals it by throwing.
    return null;
  }
}
