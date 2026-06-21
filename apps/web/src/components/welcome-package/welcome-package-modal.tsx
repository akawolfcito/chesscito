"use client";

import { useTranslations } from "next-intl";
import { WELCOME_PACKAGE_REWARD } from "@/lib/welcome-package/types";

type Props = {
  onClaim: () => void;
  onDismiss: () => void;
};

export function WelcomePackageModal({ onClaim, onDismiss }: Props) {
  const t = useTranslations("WELCOME_PACKAGE_COPY");

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center"
      style={{ background: "rgba(30, 15, 5, 0.72)" }}
      data-testid="welcome-package-modal"
    >
      <div
        className="relative mx-4 flex w-full max-w-[340px] flex-col items-center gap-4 rounded-2xl px-6 py-8 text-center shadow-2xl"
        style={{ background: "rgba(255, 248, 235, 0.98)" }}
      >
        {/* Focus Stamp visual — falls back to text label if asset is absent */}
        <div className="flex h-20 w-20 items-center justify-center rounded-full border-2 border-amber-400/40 bg-amber-50">
          <picture>
            <source srcSet={`${WELCOME_PACKAGE_REWARD.assetBase}.avif`} type="image/avif" />
            <source srcSet={`${WELCOME_PACKAGE_REWARD.assetBase}.webp`} type="image/webp" />
            <img
              src={`${WELCOME_PACKAGE_REWARD.assetBase}.png`}
              alt={t("stampLabel")}
              className="h-14 w-14 object-contain"
              onError={(e) => {
                const target = e.currentTarget;
                target.style.display = "none";
                target.parentElement?.classList.add("wp-stamp-fallback");
              }}
            />
          </picture>
          {/* Always-rendered fallback text — visible when image fails to load */}
          <span
            className="wp-stamp-text text-xs font-extrabold text-amber-700"
            aria-label={t("stampLabel")}
          >
            {t("stampLabel")}
          </span>
        </div>

        <div className="flex flex-col gap-1.5">
          <h2
            className="text-xl font-extrabold leading-tight"
            style={{ color: "rgba(63, 34, 8, 0.95)" }}
          >
            {t("title")}
          </h2>
          <p
            className="text-sm font-semibold"
            style={{ color: "rgba(63, 34, 8, 0.75)" }}
          >
            {t("subtitle")}
          </p>
          <p
            className="text-xs font-medium"
            style={{ color: "rgba(63, 34, 8, 0.55)" }}
          >
            {t("body")}
          </p>
        </div>

        <div className="flex w-full flex-col gap-2 pt-1">
          <button
            type="button"
            onClick={onClaim}
            className="principal-button principal-button-medium w-full"
          >
            <span className="principal-button-label">{t("claimCta")}</span>
          </button>

          <button
            type="button"
            onClick={onDismiss}
            className="text-sm font-semibold underline underline-offset-4"
            style={{ color: "rgba(63, 34, 8, 0.50)" }}
          >
            {t("dismissCta")}
          </button>
        </div>
      </div>
    </div>
  );
}
