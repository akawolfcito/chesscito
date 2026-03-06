import { TxFeedbackCard } from "@/components/play-hub/tx-feedback-card";

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
  const readiness = !isConnected ? "Wallet desconectada" : isCorrectChain ? "Red correcta" : "Red incorrecta";
  const missionStatus = missionCompleted ? "Challenge completado" : "Challenge pendiente";

  return (
    <div className="space-y-2">
      <div className="mission-soft rounded-xl px-3 py-2 text-xs">
        <p>Estado: {readiness}</p>
        <p>Chain: {chainId ?? "n/a"}</p>
        <p>Mision: {missionStatus}</p>
        <p>Badge: {hasClaimedBadge ? "Claimed" : "Pending"}</p>
      </div>

      {submitTxHash && isSubmitConfirming ? (
        <TxFeedbackCard
          tone="pending"
          title="Submit en progreso"
          message="Esperando confirmacion on-chain para submit score."
          txHash={submitTxHash}
          txHref={txLink(submitTxHash)}
        />
      ) : null}
      {submitTxHash && !isSubmitConfirming ? (
        <TxFeedbackCard
          tone="success"
          title="Score guardado"
          message="Transaccion confirmada para submit score."
          txHash={submitTxHash}
          txHref={txLink(submitTxHash)}
        />
      ) : null}

      {claimTxHash && isClaimConfirming ? (
        <TxFeedbackCard
          tone="pending"
          title="Claim en progreso"
          message="Esperando confirmacion on-chain para claim badge."
          txHash={claimTxHash}
          txHref={txLink(claimTxHash)}
        />
      ) : null}
      {claimTxHash && !isClaimConfirming ? (
        <TxFeedbackCard
          tone="success"
          title="Badge reclamado"
          message="Transaccion confirmada para claim badge."
          txHash={claimTxHash}
          txHref={txLink(claimTxHash)}
        />
      ) : null}

      {shopTxHash && isShopConfirming ? (
        <TxFeedbackCard
          tone="pending"
          title="Compra en progreso"
          message="Esperando confirmacion on-chain de la compra."
          txHash={shopTxHash}
          txHref={txLink(shopTxHash)}
        />
      ) : null}
      {shopTxHash && !isShopConfirming ? (
        <TxFeedbackCard
          tone="success"
          title="Compra completada"
          message="Compra on-chain confirmada."
          txHash={shopTxHash}
          txHref={txLink(shopTxHash)}
        />
      ) : null}

      {lastError ? <TxFeedbackCard tone="error" title="Error" message={lastError} /> : null}
    </div>
  );
}
