"use client";

import { useTranslations } from "next-intl";
import { WELCOME_PACKAGE_REWARD } from "@/lib/welcome-package/types";
import { VictoryPopupShell } from "@/components/arena/victory-popup-shell";
import { PrincipalButton } from "@/components/scene-rooted/principal-button";
import { TxProgressSteps } from "@/components/redesign/tx-progress-steps";

export type ClaimPhase = "idle" | "signing" | "success" | "error";

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
    <picture>
      <source srcSet={`${WELCOME_PACKAGE_REWARD.assetBase}.avif`} type="image/avif" />
      <source srcSet={`${WELCOME_PACKAGE_REWARD.assetBase}.webp`} type="image/webp" />
      <img
        src={`${WELCOME_PACKAGE_REWARD.assetBase}.png`}
        alt=""
        aria-hidden="true"
        className={`${cls} object-contain`}
        draggable={false}
      />
    </picture>
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

  return (
    <div data-testid="welcome-package-modal">
      <VictoryPopupShell
        onClose={isSigning ? undefined : (isSuccess ? onSuccess : onDismiss)}
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
