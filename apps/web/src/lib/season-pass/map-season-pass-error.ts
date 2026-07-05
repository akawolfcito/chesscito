export function mapSeasonPassError(reason: string | null | undefined): string {
  switch (reason) {
    case "included_with_pro":
      return "Included with PRO.";
    case "rail_not_configured":
    case "no_treasury":
    case "unavailable":
      return "Payments are not configured yet.";
    case "unsupported_chain":
    case "wrong_chain":
      return "Switch to Celo Mainnet.";
    case "unsupported_token":
      return "Choose USDC, USDT or cUSD.";
    case "tx_rejected":
    case "user_rejected":
      return "Transaction was cancelled.";
    case "verification_failed":
    case "verify_failed":
    case "transfer_not_found":
    case "not_direct_transfer":
    case "amount_too_low":
    case "receipt_not_found":
    case "ledger_unavailable":
    case "ledger_write_failed":
    case "entitlement_unavailable":
      return "We could not verify the payment yet.";
    default:
      return "Payment failed. Try again.";
  }
}
