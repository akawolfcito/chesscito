import {
  TransactionReceiptUnverifiableError,
  TransactionRevertedError,
  TransactionTimeoutError,
} from "@/lib/contracts/transaction-helpers";
import { decodeContractErrorName } from "@/lib/contracts/decode-contract-error";
import { findRevertDataInError } from "@/lib/contracts/revert-data";

export function isUserCancellation(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error);
  const lower = msg.toLowerCase();
  return lower.includes("user rejected") || lower.includes("user denied") || lower.includes("cancelled");
}

export function isTransactionTimeout(error: unknown): boolean {
  if (error instanceof TransactionTimeoutError) return true;
  if (error instanceof Error && error.name === "TransactionTimeoutError") return true;
  if (error instanceof Error && error.name === "WaitForTransactionReceiptTimeoutError") return true;
  const msg = error instanceof Error ? error.message : String(error);
  return /transaction timed out/i.test(msg);
}

/** A mined-and-reverted transaction. Recognized by type, never by prose —
 *  the `name` fallback mirrors `isTransactionTimeout` and covers errors that
 *  cross a bundle/realm boundary and lose `instanceof`. */
export function isTransactionReverted(error: unknown): boolean {
  if (error instanceof TransactionRevertedError) return true;
  return error instanceof Error && error.name === "TransactionRevertedError";
}

/** A receipt with no readable `status`. Distinct from a revert: the chain gave
 *  no verdict, so we must not claim it gave one. */
export function isReceiptUnverifiable(error: unknown): boolean {
  if (error instanceof TransactionReceiptUnverifiableError) return true;
  return error instanceof Error && error.name === "TransactionReceiptUnverifiableError";
}

/** Locale-agnostic identifier for the kind of tx error. Stable across
 *  locales so telemetry stays comparable (en/es users emit the same
 *  `error_kind` value). Pair with `classifyTxError(error, t)` when the
 *  caller needs the user-facing message instead. */
export type TxErrorKind =
  | "cancelled"
  | "timeout"
  | "insufficientFunds"
  | "network"
  | "badgeAlreadyClaimed"
  | "cooldownActive"
  | "dailyLimitReached"
  | "signatureExpired"
  | "signingUnavailable"
  | "revert"
  | "unknown";

/** The custom errors that have earned words of their own.
 *
 *  The four player-facing contracts declare 53 errors between them (see the
 *  generated ABI). Almost all are operator or configuration faults —
 *  `ItemDisabled`, `InvalidSigner`, `LengthMismatch` — and a player can do
 *  nothing with them, so they keep the generic revert copy. An error belongs in
 *  this map only if knowing its name changes what the player would DO next.
 *
 *  `MintCooldown` (VictoryNFT) and `CooldownActive` (Scoreboard) are two names
 *  for one experience: wait a moment. They share the copy on purpose. */
const CUSTOM_ERROR_KINDS: Record<string, TxErrorKind> = {
  BadgeAlreadyClaimed: "badgeAlreadyClaimed",
  CooldownActive: "cooldownActive",
  MintCooldown: "cooldownActive",
  DailyLimitReached: "dailyLimitReached",
  SignatureExpired: "signatureExpired",
};

/** The kind named by the contract's own revert data, or `null` when there is
 *  none, it does not decode, or the error it names has no player copy.
 *
 *  This is the only branch in the module that rests on evidence rather than
 *  prose: the contract said which error it threw. It is also the only branch
 *  that can go silently blind — the revert data rides inside a provider's
 *  stringified message, which is not an API (see `revert-data.ts`). Every step
 *  degrades to `null`, and `null` means "carry on as before". */
function classifyCustomError(error: unknown): TxErrorKind | null {
  const name = decodeContractErrorName(findRevertDataInError(error));
  return name ? (CUSTOM_ERROR_KINDS[name] ?? null) : null;
}

/** A 4xx/5xx from a signing call, anchored to the literal "http" so it
 *  cannot match the digits of a contract address, tx hash, or call arg. */
const HTTP_STATUS_RE = /\bhttp[\s_-]?[45]\d{2}\b/;

export function classifyTxErrorKind(error: unknown): TxErrorKind {
  const msg = error instanceof Error ? error.message : String(error);
  const lower = msg.toLowerCase();

  // What the contract itself said, when it said anything. Computed up front but
  // deliberately NOT returned yet: a decoded name tells us which revert this
  // was, never whether a revert is the right story to tell.
  const custom = classifyCustomError(error);

  // Typed outcomes are decided before a single character of prose is read.
  // These errors carry a receipt: we KNOW what happened. Letting the string
  // heuristics run first would let a revert whose message mentions "cancelled"
  // or "400" be silently reclassified — the failure mode this whole module
  // exists to prevent.
  if (isTransactionReverted(error)) return custom ?? "revert";
  // No verdict from the chain is not a verdict of failure. It must never
  // report as `revert`, and it must never render as success.
  if (isReceiptUnverifiable(error)) return "unknown";

  // Cancellation and timeout outrank the decoded error ON PURPOSE. viem reports
  // a wallet rejection as ContractFunctionRevertedError — a revert-shaped class
  // for a transaction that never reached the chain — so a decoder given the
  // first vote would turn every cancelled tx into a reported failure. These two
  // are facts about the WALLET; the revert data is a fact about the CHAIN, and
  // the chain only gets to speak once we know the player let it.
  if (isUserCancellation(error)) return "cancelled";
  // Timeout takes priority over generic network so the player learns
  // their tx may still be pending in the wallet rather than blaming
  // their connection.
  if (isTransactionTimeout(error)) return "timeout";

  // Past this point the contract's own word beats every substring heuristic
  // below it. This is the branch MiniPay actually walks: it rejects a reverting
  // tx at `eth_estimateGas`, so nothing is ever mined and no typed
  // TransactionRevertedError is ever constructed — the only evidence is the
  // revert data buried in the message.
  if (custom) return custom;

  if (lower.includes("insufficient funds") || lower.includes("exceeds balance")) {
    return "insufficientFunds";
  }
  if (lower.includes("network") || lower.includes("disconnected")) return "network";
  if (lower.includes("badgealreadyclaimed") || lower.includes("already claimed")) {
    return "badgeAlreadyClaimed";
  }
  // An on-chain revert is self-identifying, so it settles the question
  // before any of the fuzzy substring checks below get a vote. This
  // ordering is load-bearing: viem echoes the call args into the
  // message ("args: (1, 2400, 18000, ...)"), and the signing branch
  // used to test for the bare substring "400". Every revert whose
  // score, timeMs, nonce or unix deadline happened to contain those
  // three digits was reported to the player as "Signing service
  // unavailable" — a server outage that never happened.
  if (lower.includes("revert") || lower.includes("execution reverted")) return "revert";

  // Server signing endpoint missing config or unavailable. Most often
  // surfaced in local dev when the operator forgot the encrypted
  // signer envs (DRAGON / TORRE_PRINCESA), but also catches prod
  // signer outages. Distinct from user-cancellable errors so the
  // player understands the issue isn't on their side.
  //
  // The "unsupported state or unable to authenticate data" branch is
  // the GCM auth-tag mismatch surfaced by Node's crypto when the
  // TORRE_PRINCESA key doesn't decrypt the DRAGON ciphertext (rotated
  // key, copied wrong env, mismatched envs from prod/dev).
  //
  // HTTP_STATUS_RE requires the literal "http" prefix. `requestSignature`
  // throws the server's `error` string rather than the status code, so
  // the fallback messages it can produce are matched by name below.
  if (
    lower.includes("missing required env") ||
    lower.includes("sign-badge") ||
    lower.includes("sign-score") ||
    lower.includes("sign-victory") ||
    lower.includes("unsupported state") ||
    lower.includes("authenticate data") ||
    lower.includes("could not fetch signature") ||
    lower.includes("could not sign") ||
    HTTP_STATUS_RE.test(lower) ||
    lower.includes("signing")
  ) {
    return "signingUnavailable";
  }
  return "unknown";
}

/** Map a TxErrorKind to its localized message via the active
 *  `RESULT_OVERLAY_COPY.error` translator. Callers pass the `t`
 *  returned from `useTranslations("RESULT_OVERLAY_COPY")` so the same
 *  classifier renders in EN or ES without per-locale duplication. */
type ErrorTranslator = (key: string) => string;

export function classifyTxError(error: unknown, t: ErrorTranslator): string {
  return t(`error.${classifyTxErrorKind(error)}`);
}
