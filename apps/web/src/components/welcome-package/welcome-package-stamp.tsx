"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { WELCOME_PACKAGE_REWARD } from "@/lib/welcome-package/types";
import { useWelcomePackage } from "@/lib/welcome-package/use-welcome-package";
import { WelcomePackageModal } from "./welcome-package-modal";

export function WelcomePackageStamp() {
  const t = useTranslations("WELCOME_PACKAGE_COPY");
  const welcomePackage = useWelcomePackage();
  const [showModal, setShowModal] = useState(false);

  if (!welcomePackage.isPending && !welcomePackage.isClaimed) return null;

  return (
    <>
      {showModal && (
        <WelcomePackageModal
          onClaim={() => {
            welcomePackage.claim();
            setShowModal(false);
          }}
          onDismiss={() => {
            setShowModal(false);
          }}
        />
      )}

      <div
        className="achievement-tile-grid"
        data-testid="welcome-package-stamp"
      >
        {welcomePackage.isClaimed ? (
          <div className="achievement-tile">
            <div className="achievement-tile-icon-wrap">
              <picture>
                <source srcSet={`${WELCOME_PACKAGE_REWARD.assetBase}.avif`} type="image/avif" />
                <source srcSet={`${WELCOME_PACKAGE_REWARD.assetBase}.webp`} type="image/webp" />
                <img
                  src={`${WELCOME_PACKAGE_REWARD.assetBase}.png`}
                  alt={t("stampLabel")}
                  className="h-8 w-8 object-contain"
                  onError={(e) => { e.currentTarget.style.display = "none"; }}
                />
              </picture>
            </div>
            <h4 className="achievement-tile-title">{t("trophiesClaimedLabel")}</h4>
            <p className="achievement-tile-objective">{t("trophiesClaimedDescription")}</p>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setShowModal(true)}
            className="achievement-tile active:scale-95"
            data-testid="welcome-package-pending"
          >
            <div className="achievement-tile-icon-wrap">
              <div className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-amber-400/50 bg-amber-50">
                <span className="text-[10px] font-black text-amber-700">D1</span>
              </div>
              <div className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-amber-400 ring-2 ring-white/60" aria-hidden="true" />
            </div>
            <h4 className="achievement-tile-title">{t("trophiesPendingLabel")}</h4>
            <p className="achievement-tile-objective">{t("trophiesPendingHint")}</p>
          </button>
        )}
      </div>
    </>
  );
}
