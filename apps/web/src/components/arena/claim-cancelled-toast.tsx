"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";

type Props = {
  /** Auto-dismiss callback — the parent lowers its "just cancelled" latch. */
  onDismiss: () => void;
};

/**
 * Transient notice for a claim the player rejected in their wallet.
 *
 * Rejecting an optional flow used to mount a full VictoryClaimError popup that
 * replaced the celebration, leaving Try Again / Play Again / close as the only
 * exits. Now the victory screen stays put and this is the entire trace: no
 * transaction, nothing charged, claim still available here and in the Journal.
 *
 * Neutral by design — no check mark, no rose tones. A cancellation is not a
 * success and not an error, so it borrows the vocabulary of neither.
 */
export function ClaimCancelledToast({ onDismiss }: Props) {
  const t = useTranslations("VICTORY_CLAIM_COPY");

  useEffect(() => {
    const id = setTimeout(onDismiss, 3200);
    return () => clearTimeout(id);
  }, [onDismiss]);

  return (
    <div className="coach-mint-toast" role="status" aria-live="polite">
      <span className="coach-mint-toast__label">{t("cancelledToast")}</span>
    </div>
  );
}
