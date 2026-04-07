import { TxFeedbackCard } from "@/components/play-hub/tx-feedback-card";
import { CHAIN_NAMES, GLOSSARY, STATUS_STRIP_COPY } from "@/lib/content/editorial";

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
  const readiness = !isConnected ? STATUS_STRIP_COPY.walletNotConnected : isCorrectChain ? STATUS_STRIP_COPY.networkReady : STATUS_STRIP_COPY.switchNetwork;
  const piecePathStatus = missionCompleted ? STATUS_STRIP_COPY.piecePathComplete : STATUS_STRIP_COPY.piecePathInProgress;

  return (
    <div className="space-y-2">
      <div className="mission-soft rune-frame rounded-xl px-3 py-2 text-xs text-cyan-50">
        <p>{readiness}</p>
        <p>Network: {chainId != null ? (CHAIN_NAMES[chainId] ?? `Chain ${chainId}`) : "n/a"}</p>
        <p>{GLOSSARY.piecePath}: {piecePathStatus}</p>
        <p>{GLOSSARY.badge}: {hasClaimedBadge ? STATUS_STRIP_COPY.badgeClaimed : STATUS_STRIP_COPY.badgeReady}</p>
      </div>

      {submitTxHash && isSubmitConfirming ? (
        <TxFeedbackCard
          tone="pending"
          title={STATUS_STRIP_COPY.submittingScore}
          message={STATUS_STRIP_COPY.waitingConfirmation}
          txHash={submitTxHash}
          txHref={txLink(submitTxHash)}
        />
      ) : null}
      {submitTxHash && !isSubmitConfirming ? (
        <TxFeedbackCard
          tone="success"
          title={STATUS_STRIP_COPY.scoreSubmitted}
          message={STATUS_STRIP_COPY.scoreOnchain}
          txHash={submitTxHash}
          txHref={txLink(submitTxHash)}
        />
      ) : null}

      {claimTxHash && isClaimConfirming ? (
        <TxFeedbackCard
          tone="pending"
          title={STATUS_STRIP_COPY.claimingBadge}
          message={STATUS_STRIP_COPY.waitingConfirmation}
          txHash={claimTxHash}
          txHref={txLink(claimTxHash)}
        />
      ) : null}
      {claimTxHash && !isClaimConfirming ? (
        <TxFeedbackCard
          tone="success"
          title={STATUS_STRIP_COPY.badgeClaimed2}
          message={STATUS_STRIP_COPY.badgeOnchain}
          txHash={claimTxHash}
          txHref={txLink(claimTxHash)}
        />
      ) : null}

      {shopTxHash && isShopConfirming ? (
        <TxFeedbackCard
          tone="pending"
          title={STATUS_STRIP_COPY.processingPurchase}
          message={STATUS_STRIP_COPY.waitingConfirmation}
          txHash={shopTxHash}
          txHref={txLink(shopTxHash)}
        />
      ) : null}
      {shopTxHash && !isShopConfirming ? (
        <TxFeedbackCard
          tone="success"
          title={STATUS_STRIP_COPY.purchaseComplete}
          message={STATUS_STRIP_COPY.purchaseOnchain}
          txHash={shopTxHash}
          txHref={txLink(shopTxHash)}
        />
      ) : null}

      {lastError ? <TxFeedbackCard tone="error" title="Error" message={lastError} /> : null}
    </div>
  );
}
