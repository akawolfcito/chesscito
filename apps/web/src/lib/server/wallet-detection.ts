/**
 * Server-side wallet WebView detection from a User-Agent header.
 * Used by `/` to redirect MiniPay (and similar wallet) visitors
 * directly to `/hub`, bypassing the public landing.
 *
 * Detection is conservative: only fingerprints we have evidence of
 * shipping with a distinctive UA. Wallets we miss here fall through
 * to the client-side `useMiniPay` fallback in the landing component.
 *
 * Always returns a stable wallet identifier (lowercase) for telemetry,
 * or null if no wallet was detected.
 */

const WALLET_FINGERPRINTS = [
  // MiniPay (Opera Mini wallet on Celo) — primary target. UA contains
  // "MiniPay" verbatim.
  { token: "MiniPay", id: "minipay" },
  // Valora — Celo's reference mobile wallet.
  { token: "Valora", id: "valora" },
  // Coinbase Wallet WebView — frequent EVM wallet, sends a CoinbaseWallet
  // fragment in the UA.
  { token: "CoinbaseWallet", id: "coinbase-wallet" },
  // Trust Wallet WebView — adds "Trust" to the UA.
  { token: "Trust", id: "trust-wallet" },
] as const;

export function detectWalletFromUserAgent(
  userAgent: string | null | undefined,
): string | null {
  if (!userAgent) return null;
  for (const { token, id } of WALLET_FINGERPRINTS) {
    if (userAgent.includes(token)) return id;
  }
  return null;
}
