"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";
import { CandyIcon } from "@/components/redesign/candy-icon";
import { ThemeAssetPicture } from "@/components/themes/theme-asset-picture";
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
    /* ⛔ THIS USED TO BE `if (claimPhase === "signing") return`, and that hard
       return was the second half of the dead end reported from the MiniPay
       smoke: the modal offered no exit, and even when one was added here the
       owner refused it. A signature that neither resolves nor rejects left the
       player with a screen they could not leave.

       The modal now only offers the escape once the signature has clearly
       stalled (`SIGNING_GRACE_MS`), so honouring it here cannot interrupt a
       real signing.

       ⚠️ The phase MUST be reset with it. Leaving it on `signing` would make
       the next open a fresh trap: `handleClaim` early-returns unless the phase
       is `idle`, so the Claim button would render and do nothing, forever.

       ⛔ The pending signature is NOT cancelled. If the wallet answers later,
       `.then` still runs `onClaimed()` and the gift is still claimed — closing
       the sheet costs the player nothing. */
    if (claimPhase === "signing") handleRetry();
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
              <ThemeAssetPicture slot="welcome.focus-stamp" alt="" aria-hidden="true" className="achievement-tile-badge-img" draggable={false} onError={(e) => { e.currentTarget.style.display = "none"; }} />
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
              <ThemeAssetPicture slot="welcome.focus-stamp" alt="" aria-hidden="true" className="achievement-tile-badge-img" draggable={false} onError={(e) => { e.currentTarget.style.display = "none"; }} />
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
