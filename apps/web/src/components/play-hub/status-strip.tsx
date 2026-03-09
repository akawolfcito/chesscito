import { TxFeedbackCard } from "@/components/play-hub/tx-feedback-card";
import { GLOSSARY } from "@/lib/content/editorial";

type StatusStripProps = {
  chainId: number | undefined;
  isConnected: boolean;
  isCorrectChain: boolean;
  missionCompleted: boolean;
  hasClaimedBadge: boolean | undefined;
  shopTxHash: string | null;
  claimTxHash: string | null;
  submitTxHash: string | null;
  isShopConfirming: boolean;
  isClaimConfirming: boolean;
  isSubmitConfirming: boolean;
  lastError: string | null;
  txLink: (txHash: string) => string;
};

export function StatusStrip({
  chainId,
  isConnected,
  isCorrectChain,
  missionCompleted,
  hasClaimedBadge,
  shopTxHash,
  claimTxHash,
  submitTxHash,
  isShopConfirming,
  isClaimConfirming,
  isSubmitConfirming,
  lastError,
  txLink,
}: StatusStripProps) {
  const readiness = !isConnected ? "Wallet not connected" : isCorrectChain ? "Network ready" : "Switch to the supported network";
  const piecePathStatus = missionCompleted ? "Piece Path complete" : "Piece Path in progress";

  return (
    <div className="space-y-2">
      <div className="mission-soft rune-frame rounded-xl px-3 py-2 text-xs text-cyan-50">
        <p>Status: {readiness}</p>
        <p>Chain: {chainId ?? "n/a"}</p>
        <p>{GLOSSARY.piecePath}: {piecePathStatus}</p>
        <p>{GLOSSARY.badge}: {hasClaimedBadge ? "Claimed" : "Ready to claim"}</p>
      </div>

      {submitTxHash && isSubmitConfirming ? (
        <TxFeedbackCard
          tone="pending"
          title="Submitting score"
          message="Waiting for onchain confirmation."
          txHash={submitTxHash}
          txHref={txLink(submitTxHash)}
        />
      ) : null}
      {submitTxHash && !isSubmitConfirming ? (
        <TxFeedbackCard
          tone="success"
          title="Score submitted"
          message="Your score is now recorded onchain."
          txHash={submitTxHash}
          txHref={txLink(submitTxHash)}
        />
      ) : null}

      {claimTxHash && isClaimConfirming ? (
        <TxFeedbackCard
          tone="pending"
          title="Claiming badge"
          message="Waiting for onchain confirmation."
          txHash={claimTxHash}
          txHref={txLink(claimTxHash)}
        />
      ) : null}
      {claimTxHash && !isClaimConfirming ? (
        <TxFeedbackCard
          tone="success"
          title="Badge claimed"
          message="Your badge is now confirmed onchain."
          txHash={claimTxHash}
          txHref={txLink(claimTxHash)}
        />
      ) : null}

      {shopTxHash && isShopConfirming ? (
        <TxFeedbackCard
          tone="pending"
          title="Processing purchase"
          message="Waiting for onchain confirmation."
          txHash={shopTxHash}
          txHref={txLink(shopTxHash)}
        />
      ) : null}
      {shopTxHash && !isShopConfirming ? (
        <TxFeedbackCard
          tone="success"
          title="Purchase complete"
          message="Your purchase is now confirmed onchain."
          txHash={shopTxHash}
          txHref={txLink(shopTxHash)}
        />
      ) : null}

      {lastError ? <TxFeedbackCard tone="error" title="Error" message={lastError} /> : null}
    </div>
  );
}
