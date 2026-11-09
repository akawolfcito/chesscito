/** Finds the raw revert data inside a thrown wallet error, wherever the wallet
 *  happened to put it.
 *
 *  Promoted out of `lib/debug/serialize-tx-error.ts`, which is scaffolding that
 *  dies with the `/dev/tx-error-probe` page. The regex below is production code
 *  now, and there is exactly one copy of it in the repo.
 *
 *  Measured on device 2026-07-10 (iPhone / iOS 18.7 / MiniPay, mainnet):
 *  MiniPay rejects a reverting tx at `eth_estimateGas` and never opens the
 *  confirmation sheet. viem reads the node's whole JSON-RPC error blob as the
 *  revert *reason string*, so `error.data`, `.raw` and `.signature` all come
 *  back null and the ONLY carrier is the message text. */

/** `{"jsonrpc":"2.0","id":1,"error":{"code":3,"message":"execution reverted","data":"0x..."}}`
 *  embedded inside a viem error message.
 *
 *  This is not an API. It is a provider's stringified error that happens to be
 *  parseable, and a MiniPay update can change its shape without telling us. It
 *  is allowed to stop matching; it is not allowed to throw. Every caller treats
 *  `null` as "ordinary revert" and shows the copy it always showed. */
const DATA_IN_MESSAGE = /"data"\s*:\s*"(0x[0-9a-fA-F]{8,})"/;

export function extractRevertDataFromMessage(message: string): string | null {
  return message.match(DATA_IN_MESSAGE)?.[1] ?? null;
}

/** Depth cap: a `cause` cycle must not hang the caller. */
const MAX_DEPTH = 8;

function isHexData(value: unknown): value is string {
  return typeof value === "string" && value.startsWith("0x") && value.length >= 10;
}

/** Reads revert data off one link of the error chain, checking the places
 *  different wallets put it. MiniPay uses the message; a wallet that hands viem
 *  structured data lands in `.data` (sometimes nested one level, as
 *  `{ data: { data: "0x..." } }`), and viem itself exposes a bare 4-byte
 *  `signature` when the ABI it was given lacked the error. Only MiniPay's path
 *  has been seen in the field — the others are cheap insurance for Android and
 *  for any web wallet. */
function revertDataOf(link: unknown): string | null {
  if (typeof link !== "object" || link === null) return null;
  const bag = link as { message?: unknown; data?: unknown; signature?: unknown };

  if (typeof bag.message === "string") {
    const fromMessage = extractRevertDataFromMessage(bag.message);
    if (fromMessage) return fromMessage;
  }

  if (isHexData(bag.data)) return bag.data;

  if (typeof bag.data === "object" && bag.data !== null) {
    const nested = (bag.data as { data?: unknown }).data;
    if (isHexData(nested)) return nested;
  }

  if (isHexData(bag.signature)) return bag.signature;

  return null;
}

/** Walks the `cause` chain outermost-first and returns the first revert data it
 *  finds, or `null`. Never throws. */
export function findRevertDataInError(error: unknown): string | null {
  const seen = new Set<unknown>();
  let current: unknown = error;

  for (let depth = 0; depth <= MAX_DEPTH; depth += 1) {
    if (current === undefined || current === null || seen.has(current)) break;
    seen.add(current);

    const found = revertDataOf(current);
    if (found) return found;

    current =
      typeof current === "object" && current !== null
        ? (current as { cause?: unknown }).cause
        : undefined;
  }

  return null;
}
