import { TransactionTimeoutError } from "@/lib/contracts/transaction-helpers";

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
  | "signingUnavailable"
  | "revert"
  | "unknown";

/** A 4xx/5xx from a signing call, anchored to the literal "http" so it
 *  cannot match the digits of a contract address, tx hash, or call arg. */
const HTTP_STATUS_RE = /\bhttp[\s_-]?[45]\d{2}\b/;

export function classifyTxErrorKind(error: unknown): TxErrorKind {
  const msg = error instanceof Error ? error.message : String(error);
  const lower = msg.toLowerCase();

  if (isUserCancellation(error)) return "cancelled";
  // Timeout takes priority over generic network so the player learns
  // their tx may still be pending in the wallet rather than blaming
  // their connection.
  if (isTransactionTimeout(error)) return "timeout";
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
