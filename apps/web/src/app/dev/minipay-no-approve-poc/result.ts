export type PocTxStatus = "not-run" | "success" | "failed";
export type PocConclusion = "yes" | "no" | "inconclusive";
export type TreasuryPocConclusion =
  | "single-user-tx treasury payment viable"
  | "failed"
  | "inconclusive";

export type PocClassification = {
  conclusion: PocConclusion;
  reason: string;
};

const ALLOWANCE_FAILURE_PATTERNS = [
  "allowance",
  "transfer amount exceeds allowance",
  "insufficient allowance",
  "transferfrom",
  "transfer from failed",
] as const;

export function isAllowanceFailure(error: string | null): boolean {
  if (!error) return false;
  const normalized = error.toLowerCase();
  return ALLOWANCE_FAILURE_PATTERNS.some((pattern) => normalized.includes(pattern));
}

export function classifyPocResult(input: {
  status: PocTxStatus;
  contractTxAttempted: boolean;
  allowanceBefore: bigint | null;
  requiredAmount: bigint | null;
  error: string | null;
}): PocClassification {
  if (input.status === "success") {
    if (
      input.allowanceBefore != null &&
      input.requiredAmount != null &&
      input.allowanceBefore < input.requiredAmount
    ) {
      return {
        conclusion: "yes",
        reason: "buyItem succeeded even though the pre-submit allowance was below the required amount.",
      };
    }

    return {
      conclusion: "inconclusive",
      reason: "buyItem succeeded, but an existing allowance may have authorized transferFrom.",
    };
  }

  if (
    input.status === "failed" &&
    input.contractTxAttempted &&
    isAllowanceFailure(input.error)
  ) {
    return {
      conclusion: "no",
      reason: "The contract transaction failed with an allowance or transferFrom authorization error.",
    };
  }

  if (input.status === "failed") {
    return {
      conclusion: "inconclusive",
      reason: "The transaction failed for a reason that does not prove whether approval is required.",
    };
  }

  return {
    conclusion: "inconclusive",
    reason: "The contract transaction has not been run.",
  };
}

export function classifyTreasuryTransferResult(input: {
  transferFailed: boolean;
  receiptStatus: "success" | "reverted" | null;
  transferEventVerified: boolean;
}): TreasuryPocConclusion {
  if (input.transferFailed || input.receiptStatus === "reverted") return "failed";
  if (input.receiptStatus === "success" && input.transferEventVerified) {
    return "single-user-tx treasury payment viable";
  }
  return "inconclusive";
}
