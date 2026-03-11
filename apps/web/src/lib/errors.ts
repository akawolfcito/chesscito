import { RESULT_OVERLAY_COPY } from "@/lib/content/editorial";

const copy = RESULT_OVERLAY_COPY.error;

export function isUserCancellation(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error);
  const lower = msg.toLowerCase();
  return lower.includes("user rejected") || lower.includes("user denied") || lower.includes("cancelled");
}

export function classifyTxError(error: unknown): string {
  const msg = error instanceof Error ? error.message : String(error);
  const lower = msg.toLowerCase();

  if (isUserCancellation(error)) {
    return copy.cancelled;
  }
  if (lower.includes("insufficient funds") || lower.includes("exceeds balance")) {
    return copy.insufficientFunds;
  }
  if (lower.includes("network") || lower.includes("timeout") || lower.includes("disconnected")) {
    return copy.network;
  }
  if (lower.includes("badgealreadyclaimed") || lower.includes("already claimed")) {
    return "You already own this badge!";
  }
  if (lower.includes("revert") || lower.includes("execution reverted")) {
    return copy.revert;
  }
  return copy.unknown;
}
