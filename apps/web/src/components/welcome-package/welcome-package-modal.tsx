"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { ThemeAssetPicture } from "@/components/themes/theme-asset-picture";
import { VictoryPopupShell } from "@/components/arena/victory-popup-shell";
import { PrincipalButton } from "@/components/scene-rooted/principal-button";
import { TxProgressSteps } from "@/components/redesign/tx-progress-steps";

export type ClaimPhase = "idle" | "signing" | "success" | "error";

/** How long a signature may sit silent before the modal offers a way out.
 *  Long enough that a player reading a wallet sheet is never interrupted;
 *  short enough that a dead provider does not become a locked screen. */
const SIGNING_GRACE_MS = 12_000;

type Props = {
  onClaim: () => void;
  onDismiss: () => void;
  onSuccess?: () => void;
  onRetry?: () => void;
  claimed?: boolean;
  phase?: ClaimPhase;
};

function StampImage({ size }: { size: "sm" | "lg" }) {
  const cls = size === "lg" ? "h-36 w-36" : "h-28 w-28";
  return (
    <ThemeAssetPicture slot="welcome.focus-stamp" alt="" aria-hidden="true" className={`${cls} object-contain`} draggable={false} />
  );
}

export function WelcomePackageModal({
  onClaim,
  onDismiss,
  onSuccess,
  onRetry,
  claimed = false,
  phase = "idle",
}: Props) {
  const t = useTranslations("WELCOME_PACKAGE_COPY");

  const isSigning = phase === "signing";
  const isSuccess = phase === "success";
  const isError = phase === "error";

  /**
   * ⛔ THE SIGNING PHASE MUST NEVER BE A DEAD END.
   *
   * `claimPhase` only leaves `signing` through `signMessageAsync().then` or
   * `.catch`. A wallet that neither resolves NOR rejects fires neither, so the
   * phase sticks forever — and this shell used to mount with
   * `onClose={isSigning ? undefined : …}`, which left the player with no exit
   * at all. Reported from the MiniPay smoke on 2026-08-20 ("no tiene salida y
   * no termina, solo se queda ahí"), on a session whose console was already
   * showing a provider in a bad state.
   *
   * Blocking the close DURING a signature is right. Blocking it FOREVER is not.
   *
   * ⚠️ This is an ESCAPE HATCH, not a timeout-to-error. It does not cancel the
   * pending signature: a slow-but-valid one that lands afterwards still claims
   * the gift. Flipping to "Something went wrong" while the wallet sheet is
   * still open would be a lie the player can disprove by finishing the signature.
   */
  const [signingStalled, setSigningStalled] = useState(false);
  useEffect(() => {
    if (!isSigning) {
      setSigningStalled(false);
      return;
    }
    const t = window.setTimeout(() => setSigningStalled(true), SIGNING_GRACE_MS);
    return () => window.clearTimeout(t);
  }, [isSigning]);

  const canClose = !isSigning || signingStalled;

  return (
    <div data-testid="welcome-package-modal">
      <VictoryPopupShell
        onClose={
          canClose ? (isSuccess ? onSuccess : onDismiss) : undefined
        }
        ariaLabel={isSuccess ? t("successTitle") : t("title")}
        closeLabel="Close"
      >
        {/* ── SUCCESS reveal ── */}
        {isSuccess ? (
          <>
            <div className="wp-stamp-container mx-auto flex flex-col items-center gap-2">
              <StampImage size="lg" />
            </div>
            <div className="flex w-full flex-col items-center gap-1 text-center">
              <h2 className="language-modal-title" data-testid="wp-success-title">
                {t("successTitle")}
              </h2>
              <p
                className="text-sm font-medium"
                style={{ color: "rgba(110, 65, 15, 0.70)" }}
              >
                {t("successBody")}
              </p>
            </div>
            <PrincipalButton
              onClick={() => onSuccess?.()}
              className="self-center"
              data-testid="wp-success-cta"
            >
              {t("successCta")}
            </PrincipalButton>
          </>
        ) : isSigning ? (
          /* ── SIGNING state ── */
          <>
            <div className="wp-stamp-container mx-auto flex flex-col items-center gap-1">
              <StampImage size="sm" />
            </div>
            <div className="flex w-full flex-col items-center gap-3 text-center">
              <p
                className="text-sm font-semibold"
                style={{ color: "rgba(110, 65, 15, 0.75)" }}
                data-testid="wp-signing-title"
              >
                {t("signingTitle")}
              </p>
              <TxProgressSteps
                variant="pills"
                flow="claim-badge"
                steps={[{ code: "sign" }]}
                current="sign"
              />
              {/* ⚠️ Appears only once the signature has clearly stalled — see
                  `SIGNING_GRACE_MS`. It uses the EXISTING `dismissCta`
                  ("Later" / "Después"), so this fix ships no new string in
                  either bundle and cannot go out half-translated.
                  ⛔ It does NOT cancel the signature: if the wallet answers
                  afterwards, the gift is still claimed. */}
              {signingStalled ? (
                <button
                  type="button"
                  data-testid="wp-signing-escape"
                  onClick={() => onDismiss?.()}
                  className="arena-result-secondary-action"
                >
                  {t("dismissCta")}
                </button>
              ) : null}
            </div>
          </>
        ) : isError ? (
          /* ── ERROR state ── */
          <>
            <div className="wp-stamp-container mx-auto flex flex-col items-center gap-1">
              <StampImage size="sm" />
            </div>
            <div className="flex w-full flex-col items-center gap-2 text-center">
              <p
                className="text-sm font-semibold"
                style={{ color: "rgba(180, 60, 30, 0.80)" }}
                data-testid="wp-error-body"
              >
                {t("errorBody")}
              </p>
            </div>
            <div className="flex w-full flex-col items-center gap-2">
              <PrincipalButton
                onClick={() => onRetry?.()}
                className="self-center"
                data-testid="wp-retry-cta"
              >
                {t("retryCta")}
              </PrincipalButton>
              <button
                type="button"
                onClick={onDismiss}
                className="text-sm font-semibold underline underline-offset-4"
                style={{ color: "rgba(110, 65, 15, 0.50)" }}
              >
                {t("dismissCta")}
              </button>
            </div>
          </>
        ) : (
          /* ── IDLE (default) ── */
          <>
            <div className="wp-stamp-container mx-auto flex flex-col items-center gap-1">
              <StampImage size="sm" />
              <span className="wp-stamp-text">{t("stampLabel")}</span>
            </div>

            <div className="flex w-full flex-col items-center gap-1 text-center">
              <h2 className="language-modal-title">{t("title")}</h2>
              <p
                className="text-sm font-semibold"
                style={{ color: "rgba(110, 65, 15, 0.75)" }}
              >
                {t("subtitle")}
              </p>
              <p
                className="text-xs font-medium"
                style={{ color: "rgba(110, 65, 15, 0.55)" }}
              >
                {t("body")}
              </p>
            </div>

            {claimed ? (
              <p
                className="w-full text-center text-sm font-semibold"
                style={{ color: "rgba(110, 65, 15, 0.70)" }}
                data-testid="wp-claimed-confirmation"
              >
                {t("claimedConfirmation")}
              </p>
            ) : (
              <div className="flex w-full flex-col items-center gap-2">
                <PrincipalButton onClick={onClaim} className="self-center">
                  {t("claimCta")}
                </PrincipalButton>
                <button
                  type="button"
                  onClick={onDismiss}
                  className="text-sm font-semibold underline underline-offset-4"
                  style={{ color: "rgba(110, 65, 15, 0.50)" }}
                >
                  {t("dismissCta")}
                </button>
              </div>
            )}
          </>
        )}
      </VictoryPopupShell>
    </div>
  );
}
