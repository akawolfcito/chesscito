/**
 * TEMPORARY — delete with `app/dev/tx-error-probe/`.
 *
 * Flattens an unknown thrown value into something a human can read off a phone
 * screen, WITHOUT leaking the server-issued EIP-712 signature that viem echoes
 * into its error messages.
 *
 * This file decodes nothing. It exists to answer one question with evidence:
 * does MiniPay preserve revert data on its way back to the dapp? Whether we
 * build a decoder is a decision that comes after, not before.
 */

/** An EIP-712 / ECDSA signature is 65 bytes → 132 chars. Revert data for two
 *  32-byte args is 138. We cannot tell them apart by length alone, so we redact
 *  long hex only inside free-text `message`, never inside a structured `data`
 *  field — which is the one thing this probe is here to read. */
const LONG_HEX = /0x[0-9a-fA-F]{100,}/g;

export function redactLongHex(text: string): string {
  return text.replace(LONG_HEX, (hex) => `0x${hex.slice(2, 8)}…[redacted ${hex.length} chars]`);
}

export type SerializedTxError = {
  /** Constructor / duck-typed error name, e.g. ContractFunctionRevertedError. */
  name: string | null;
  /** Free text, with any long hex run redacted. */
  message: string | null;
  /** JSON-RPC error code. 4001 = user rejected, 3 = execution reverted. */
  code: string | number | null;
  /** THE PRIZE: revert data, if the wallet passed it through. */
  data: unknown;
  /** Present on viem's ContractFunctionRevertedError when the ABI lacked the error. */
  signature: string | null;
  /** Own enumerable keys, so we can see what MiniPay attached that we did not expect. */
  keys: string[];
};

export type SerializedTxErrorChain = {
  top: SerializedTxError;
  /** `cause` chain, outermost first. Depth-capped: a cycle must not hang the probe. */
  causes: SerializedTxError[];
  depth: number;
};

function pick(error: unknown): SerializedTxError {
  if (typeof error !== "object" || error === null) {
    return {
      name: null,
      message: redactLongHex(String(error)),
      code: null,
      data: null,
      signature: null,
      keys: [],
    };
  }

  const bag = error as Record<string, unknown>;
  const message = typeof bag.message === "string" ? redactLongHex(bag.message) : null;
  const code = typeof bag.code === "string" || typeof bag.code === "number" ? bag.code : null;
  const signature = typeof bag.signature === "string" ? bag.signature : null;

  return {
    name: typeof bag.name === "string" ? bag.name : null,
    message,
    code,
    // `data` may be a hex string (revert data) or an object ({ data: "0x..." }).
    // Captured verbatim: it is never a secret, and it is the whole point.
    data: bag.data ?? null,
    signature,
    keys: Object.keys(bag).sort(),
  };
}

const MAX_DEPTH = 8;

export function serializeTxError(error: unknown): SerializedTxErrorChain {
  const top = pick(error);
  const causes: SerializedTxError[] = [];
  const seen = new Set<unknown>();

  let current: unknown = error;
  seen.add(current);

  while (causes.length < MAX_DEPTH) {
    const next =
      typeof current === "object" && current !== null
        ? (current as { cause?: unknown }).cause
        : undefined;
    if (next === undefined || next === null || seen.has(next)) break;
    seen.add(next);
    causes.push(pick(next));
    current = next;
  }

  return { top, causes, depth: causes.length };
}

/** The one fact that decides go / no-go: did any layer carry revert data? */
export function findRevertData(chain: SerializedTxErrorChain): string | null {
  for (const layer of [chain.top, ...chain.causes]) {
    if (typeof layer.data === "string" && layer.data.startsWith("0x") && layer.data.length >= 10) {
      return layer.data;
    }
    if (typeof layer.data === "object" && layer.data !== null) {
      const nested = (layer.data as { data?: unknown }).data;
      if (typeof nested === "string" && nested.startsWith("0x") && nested.length >= 10) {
        return nested;
      }
    }
    if (layer.signature && layer.signature.startsWith("0x") && layer.signature.length === 10) {
      return layer.signature;
    }
  }
  return null;
}
