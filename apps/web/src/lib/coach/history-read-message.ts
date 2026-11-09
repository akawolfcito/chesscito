export const HISTORY_READ_TTL_MS = 5 * 60 * 1000;
export const HISTORY_READ_ISSUED_HEADER = "x-chesscito-history-issued-at";
export const HISTORY_READ_SIGNATURE_HEADER = "x-chesscito-history-signature";

/** Reusable, read-only authorization. Never reuse a write/delete signature. */
export function buildHistoryReadMessage(origin: string, wallet: string, issuedAt: number): string {
  return [
    "Read my Chesscito Coach history and saved games",
    `Origin: ${origin}`,
    "Chain: 42220",
    `Wallet: ${wallet.toLowerCase()}`,
    `Issued: ${issuedAt}`,
    `Expires: ${issuedAt + HISTORY_READ_TTL_MS}`,
    "Read only. No transactions, payments, or changes authorized.",
  ].join("\n");
}
