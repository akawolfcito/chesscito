"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";
import { CandyIcon } from "@/components/redesign/candy-icon";
import { WELCOME_PACKAGE_REWARD } from "@/lib/welcome-package/types";
import { useWelcomePackage } from "@/lib/welcome-package/use-welcome-package";
import { useLiteWelcomeGiftClaim } from "@/lib/welcome-package/use-lite-welcome-gift-claim";
import { WelcomePackageModal } from "./welcome-package-modal";

export function WelcomePackageStamp() {
  const t = useTranslations("WELCOME_PACKAGE_COPY");
  const welcomePackage = useWelcomePackage();
  const { claimPhase, handleClaim, handleRetry, handleSuccess } = useLiteWelcomeGiftClaim();
  const [showModal, setShowModal] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => { setHydrated(true); }, []);

  if (!welcomePackage.isPending && !welcomePackage.isClaimed) return null;

  function handleModalClaim() {
    handleClaim(() => {
      welcomePackage.claim();
    });
  }

  function handleModalDismiss() {
    // Never dismiss mid-signing.
    if (claimPhase === "signing") return;
    setShowModal(false);
  }

  function handleModalSuccess() {
    handleSuccess();
    setShowModal(false);
  }

  return (
    <>
      {/* Portal escapes Radix sheet stacking context — prevents overlay
          clipping in MiniPay WebView (same pattern as daily-tactic-slot). */}
      {hydrated && showModal && createPortal(
        <WelcomePackageModal
          phase={claimPhase}
          onClaim={handleModalClaim}
          onDismiss={handleModalDismiss}
          onSuccess={handleModalSuccess}
          onRetry={handleRetry}
        />,
        document.body,
      )}

      <div className="achievement-tile-grid mb-3" data-testid="welcome-package-stamp">
        {welcomePackage.isClaimed ? (
          <div className="achievement-tile achievement-tile--earned">
            <div className="achievement-tile-badge-wrap">
              <picture>
                <source srcSet={`${WELCOME_PACKAGE_REWARD.assetBase}.avif`} type="image/avif" />
                <source srcSet={`${WELCOME_PACKAGE_REWARD.assetBase}.webp`} type="image/webp" />
                <img
                  src={`${WELCOME_PACKAGE_REWARD.assetBase}.png`}
                  alt=""
                  aria-hidden="true"
                  className="achievement-tile-badge-img"
                  draggable={false}
                  onError={(e) => { e.currentTarget.style.display = "none"; }}
                />
              </picture>
              <div className="achievement-tile-state-badge achievement-tile-state-badge--earned" aria-hidden="true">
                <CandyIcon name="check" className="h-3 w-3 text-white" />
              </div>
            </div>
            <h4 className="achievement-tile-title">{t("trophiesClaimedLabel")}</h4>
            <p className="achievement-tile-objective">{t("trophiesClaimedDescription")}</p>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setShowModal(true)}
            className="achievement-tile achievement-tile--pending active:scale-95"
            data-testid="welcome-package-pending"
          >
            <div className="achievement-tile-badge-wrap">
              <picture>
                <source srcSet={`${WELCOME_PACKAGE_REWARD.assetBase}.avif`} type="image/avif" />
                <source srcSet={`${WELCOME_PACKAGE_REWARD.assetBase}.webp`} type="image/webp" />
                <img
                  src={`${WELCOME_PACKAGE_REWARD.assetBase}.png`}
                  alt=""
                  aria-hidden="true"
                  className="achievement-tile-badge-img"
                  draggable={false}
                  onError={(e) => { e.currentTarget.style.display = "none"; }}
                />
              </picture>
              {/* Amber notification dot — reward waiting to be claimed */}
              <div className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-amber-400 ring-2 ring-white/60 animate-pulse" aria-hidden="true" />
            </div>
            <h4 className="achievement-tile-title">{t("trophiesPendingLabel")}</h4>
            <p className="achievement-tile-objective">{t("trophiesPendingHint")}</p>
          </button>
        )}
      </div>
    </>
  );
}
