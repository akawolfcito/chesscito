"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { ContextualHeader } from "@/components/ui/contextual-header";
import { TileIconSlot } from "@/components/ui/tile-icon-slot";
import { CandyIcon } from "@/components/redesign/candy-icon";
import { LocaleSwitcher } from "@/components/i18n/locale-switcher";
import { ChesitoCard } from "@/components/peones/chesito-card";
import { useShieldsCount } from "@/lib/shop/use-shields-count";
import { useFounderStatus } from "@/lib/founder/use-founder-status";
import { daysRemaining } from "@/lib/pro/days-remaining";
import { CHESSCITO_LITE_MODE } from "@/lib/feature-flags";

function networkName(chainId: number | undefined, unknownLabel: string) {
  if (chainId === 42220) return "Celo";
  if (chainId === 44787) return "Alfajores";
  if (chainId === 11142220) return "Celo Sepolia";
  return unknownLabel;
}

export type AccountSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  walletAddress: string;
  walletShort: string;
  chainId: number | undefined;
  proActive: boolean;
  /** Unix-ms expiry of the active PRO pass. When paired with
   *  `proActive`, drives the "N days left" sub-line under the Manage
   *  PRO row. `null` hides the sub-line — either no PRO or the
   *  server payload omitted the timestamp. */
  proExpiresAt: number | null;
  coachCredits: number;
  onManagePro: () => void;
  onOpenCoach: () => void;
  /** 2026-05-30: open the surface where shields fire (exercises retry).
   *  Lets the user verify "yes, this is where my shields get spent". */
  onOpenShieldsHelp: () => void;
  /** 2026-05-30: open the Shop sheet — used by the Founder row when
   *  the user does not yet own the badge. Owned-state row stays
   *  decorative (status pill only). */
  onOpenShop: () => void;
  onDisconnect: () => void;
};

/** Account / identity sheet — wallet, network, Manage PRO, Coach, Shields,
 *  Founder badge, language, disconnect + About link. Extracted from
 *  exercises-screen (2026-07-07) so play + arena can mount the SAME sheet
 *  in-mode. Presentational leaf: the caller owns every handler + the data
 *  (address, PRO status, coach credits). Lite-only rows self-gate on
 *  CHESSCITO_LITE_MODE; the two inventory hooks are SSR-safe. */
export function AccountSheet({
  open,
  onOpenChange,
  walletAddress,
  walletShort,
  chainId,
  proActive,
  proExpiresAt,
  coachCredits,
  onManagePro,
  onOpenCoach,
  onOpenShieldsHelp,
  onOpenShop,
  onDisconnect,
}: AccountSheetProps) {
  const t = useTranslations("ACCOUNT_SHEET_COPY");
  const tPro = useTranslations("PRO_COPY");
  const tAbout = useTranslations("ABOUT_LINK_COPY");
  const proDaysLeft = proActive ? daysRemaining(proExpiresAt, Date.now()) : null;
  const [copied, setCopied] = useState(false);
  // 2026-05-30 (shop oscuridad fix): live inventory reads for the
  // Streak Shields + Founder Badge rows. Both hooks are SSR-safe and
  // re-render on storage changes (shields) / fetch completion (founder).
  const shieldsCount = useShieldsCount();
  const founderOwned = useFounderStatus();

  async function copyAddress() {
    try {
      await navigator.clipboard.writeText(walletAddress);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      setCopied(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        hideClose
        title={t("title")}
        description={t("description")}
        className="sheet-bg-hub rounded-none border-0 h-[100dvh] flex flex-col focus:outline-none focus-visible:outline-none"
      >
        <div className="-mx-6 -mt-6 shrink-0 border-b border-[rgba(110,65,15,0.30)]">
          <ContextualHeader
            variant="close-control"
            iconSlot={<TileIconSlot src="/art/screen-mission/account-icon" />}
            title={t("title")}
            subtitle={t("description")}
            close={{ onClick: () => onOpenChange(false), label: t("closeAriaLabel") }}
          />
        </div>

        <div className="overflow-y-auto overscroll-contain flex-1 pb-[calc(env(safe-area-inset-bottom,0px)+6rem)]">
        <div className="mt-3 flex flex-col gap-3">
          {/* Chesito Card — the rechargeable Peones "wallet" hero (balance +
           *  "+" recharge). Shown in every mode now: in Lite the header dropped
           *  its standalone Peones chip, so the Account sheet is the one wallet
           *  home (UX spec §6, 2026-07-06). Top up CTA opens the Get Peones rail. */}
          <ChesitoCard />

          <div className="account-tiles-grid">
            {/* Wallet — tile click copies the full address */}
            <button
              type="button"
              onClick={() => void copyAddress()}
              aria-label={copied ? t("copiedAddress") : t("copyAddress")}
              className="account-tile"
            >
              <span className="account-tile-icon">
                <picture>
                  <source srcSet="/art/new-assets-chesscito/account/wallet-icon.avif" type="image/avif" />
                  <source srcSet="/art/new-assets-chesscito/account/wallet-icon.webp" type="image/webp" />
                  <img
                    src="/art/new-assets-chesscito/account/wallet-icon.png"
                    alt=""
                    aria-hidden="true"
                    draggable={false}
                  />
                </picture>
              </span>
              <span className="account-tile-label">{t("walletLabel")}</span>
              <span className="account-status-pill" data-tone="celo">
                {copied ? <CandyIcon name="check" className="h-3 w-3" /> : null}
                {copied ? t("copiedAddress") : walletShort}
              </span>
            </button>

            {/* Network — read-only */}
            <div className="account-tile is-static" role="group" aria-label={t("networkLabel")}>
              <span className="account-tile-icon">
                <picture>
                  <source srcSet="/art/new-assets-chesscito/account/network-icon.avif" type="image/avif" />
                  <source srcSet="/art/new-assets-chesscito/account/network-icon.webp" type="image/webp" />
                  <img
                    src="/art/new-assets-chesscito/account/network-icon.png"
                    alt=""
                    aria-hidden="true"
                    draggable={false}
                  />
                </picture>
              </span>
              <span className="account-tile-label">{t("networkLabel")}</span>
              <span className="account-status-pill" data-tone="celo">
                <CandyIcon name="check" className="h-3 w-3" />
                {networkName(chainId, t("unknownNetwork"))}
              </span>
            </div>

            {/* Manage PRO — hidden in Lite (no Shop/PRO monetization surface) */}
            {!CHESSCITO_LITE_MODE && (
            <button
              type="button"
              onClick={onManagePro}
              className="account-tile"
            >
              <span className="account-tile-icon">
                <picture>
                  <source srcSet="/art/screen-mission/corona-pro.avif" type="image/avif" />
                  <source srcSet="/art/screen-mission/corona-pro.webp" type="image/webp" />
                  <img
                    src="/art/screen-mission/corona-pro.png"
                    alt=""
                    aria-hidden="true"
                    draggable={false}
                  />
                </picture>
              </span>
              <span className="account-tile-label">
                {proActive ? t("managePro") : t("viewPro")}
              </span>
              <span
                className="account-status-pill"
                data-tone={proActive ? "active" : "inactive"}
              >
                <span aria-hidden="true">★</span>
                {proActive && proDaysLeft != null
                  ? tPro("statusActiveSuffix", { daysLeft: proDaysLeft })
                  : proActive
                    ? t("activePro")
                    : t("inactivePro")}
              </span>
            </button>
            )}

            {/* Coach — hidden in Lite */}
            {!CHESSCITO_LITE_MODE && (() => {
              const coachStatusKey = proActive
                ? "coachStatusActive"
                : coachCredits > 0
                  ? "coachStatusFree"
                  : "coachStatusEmpty";
              const coachStatusLabel =
                !proActive && coachCredits > 0
                  ? t("coachStatusFreeWithCount", { count: coachCredits })
                  : t(coachStatusKey);
              const coachTone = proActive
                ? "active"
                : coachCredits > 0
                  ? "celo"
                  : "inactive";
              return (
                <button
                  type="button"
                  onClick={onOpenCoach}
                  aria-label={t("coachRowLabel")}
                  className="account-tile"
                >
                  <span className="account-tile-icon">
                    <picture>
                      <source srcSet="/art/new-icons-chesscito/training.avif" type="image/avif" />
                      <source srcSet="/art/new-icons-chesscito/training.webp" type="image/webp" />
                      <img
                        src="/art/new-icons-chesscito/training.png"
                        alt=""
                        aria-hidden="true"
                        draggable={false}
                      />
                    </picture>
                  </span>
                  <span className="account-tile-label">{t("coachRowLabel")}</span>
                  <span className="account-status-pill" data-tone={coachTone}>
                    {coachStatusLabel}
                  </span>
                </button>
              );
            })()}

            {/* Shields — hidden in Lite */}
            {!CHESSCITO_LITE_MODE && (
            <button
              type="button"
              onClick={onOpenShieldsHelp}
              className="account-tile"
            >
              <span className="account-tile-icon">
                <picture>
                  <source srcSet="/art/shop/shield.avif" type="image/avif" />
                  <source srcSet="/art/shop/shield.webp" type="image/webp" />
                  <img
                    src="/art/shop/shield.png"
                    alt=""
                    aria-hidden="true"
                    draggable={false}
                  />
                </picture>
              </span>
              <span className="account-tile-label">{t("shieldsRowLabel")}</span>
              <span
                className="account-status-pill"
                data-tone={shieldsCount > 0 ? "celo" : "inactive"}
              >
                {shieldsCount > 0
                  ? t("shieldsStatusAvailable", { count: shieldsCount })
                  : t("shieldsStatusEmpty")}
              </span>
            </button>
            )}

            {/* Founder Badge — hidden in Lite */}
            {!CHESSCITO_LITE_MODE && (
            <button
              type="button"
              onClick={founderOwned ? () => onOpenChange(false) : onOpenShop}
              className="account-tile"
            >
              <span className="account-tile-icon">
                <picture>
                  <source srcSet="/art/shop/founder.avif" type="image/avif" />
                  <source srcSet="/art/shop/founder.webp" type="image/webp" />
                  <img
                    src="/art/shop/founder.png"
                    alt=""
                    aria-hidden="true"
                    draggable={false}
                  />
                </picture>
              </span>
              <span className="account-tile-label">{t("founderRowLabel")}</span>
              <span
                className="account-status-pill"
                data-tone={founderOwned ? "active" : "inactive"}
              >
                {founderOwned ? t("founderStatusOwned") : t("founderStatusNotYet")}
              </span>
            </button>
            )}

            {/* Language — segmented switcher inline at tile base */}
            <div className="account-tile is-static" role="group" aria-label={t("languageLabel")}>
              <span className="account-tile-icon">
                <picture>
                  <source srcSet="/art/new-assets-chesscito/account/language-icon.avif" type="image/avif" />
                  <source srcSet="/art/new-assets-chesscito/account/language-icon.webp" type="image/webp" />
                  <img
                    src="/art/new-assets-chesscito/account/language-icon.png"
                    alt=""
                    aria-hidden="true"
                    draggable={false}
                  />
                </picture>
              </span>
              <span className="account-tile-label">{t("languageLabel")}</span>
              <LocaleSwitcher />
            </div>
          </div>

          {/* Disconnect — full-width secondary CTA */}
          <button
            type="button"
            onClick={onDisconnect}
            className="arena-result-secondary-action w-full"
          >
            <CandyIcon name="close" className="mr-2 h-4 w-4" />
            {t("disconnect")}
          </button>

          {/* About Chesscito — ghost link, secondary to Disconnect */}
          <Link
            href="/about"
            onClick={() => onOpenChange(false)}
            className="flex w-full items-center justify-center py-2 text-sm font-bold opacity-50 transition-opacity active:opacity-100"
            style={{ color: "rgba(110,65,15,0.9)", fontFamily: "var(--font-game-display)" }}
          >
            {tAbout("label")}
          </Link>
        </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
