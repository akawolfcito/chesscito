"use client";

import { useTranslations } from "next-intl";
import { WELCOME_PACKAGE_REWARD } from "@/lib/welcome-package/types";
import { VictoryPopupShell } from "@/components/arena/victory-popup-shell";
import { PrincipalButton } from "@/components/scene-rooted/principal-button";

type Props = {
  onClaim: () => void;
  onDismiss: () => void;
  claimed?: boolean;
};

export function WelcomePackageModal({ onClaim, onDismiss, claimed = false }: Props) {
  const t = useTranslations("WELCOME_PACKAGE_COPY");

  return (
    <div data-testid="welcome-package-modal">
      <VictoryPopupShell
        onClose={claimed ? undefined : onDismiss}
        ariaLabel={t("title")}
        closeLabel="Close"
      >
        {/* Focus Stamp visual — falls back to text label if asset is absent */}
        <div className="flex justify-center">
          <div className="relative flex h-28 w-28 items-center justify-center">
            <picture>
              <source srcSet={`${WELCOME_PACKAGE_REWARD.assetBase}.avif`} type="image/avif" />
              <source srcSet={`${WELCOME_PACKAGE_REWARD.assetBase}.webp`} type="image/webp" />
              <img
                src={`${WELCOME_PACKAGE_REWARD.assetBase}.png`}
                alt={t("stampLabel")}
                className="h-28 w-28 object-contain"
                onError={(e) => {
                  e.currentTarget.style.display = "none";
                }}
              />
            </picture>
            {/* Fallback text — shows when image fails to load */}
            <span
              className="wp-stamp-text absolute text-xs font-extrabold"
              style={{ color: "rgba(110, 65, 15, 0.80)" }}
              aria-label={t("stampLabel")}
            >
              {t("stampLabel")}
            </span>
          </div>
        </div>

        <div className="flex flex-col items-center gap-1 text-center">
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
            className="text-center text-sm font-semibold"
            style={{ color: "rgba(110, 65, 15, 0.70)" }}
            data-testid="wp-claimed-confirmation"
          >
            {t("claimedConfirmation")}
          </p>
        ) : (
          <div className="flex w-full flex-col gap-2">
            <PrincipalButton onClick={onClaim} className="w-full">
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
      </VictoryPopupShell>
    </div>
  );
}
