"use client";

/**
 * LanguageChip — HUD chip showing the active locale (flag + code).
 * Tap → small confirm card to switch EN ↔ ES (founder 2026-06-11).
 *
 * Same canonical chip family as the trophy / Peones chips
 * (candy-tray-pill + hub-hud-pill + anchored-left). The flag is an
 * emoji in the floating-icon slot: zero assets, crisp on mobile.
 * Switching navigates to the same pathname under the other locale
 * via the next-intl router (cookie persists the choice).
 */

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";

import { usePathname, useRouter } from "@/i18n/navigation";
import { VictoryPopupShell } from "@/components/arena/victory-popup-shell";
import { PrincipalButton } from "@/components/scene-rooted/principal-button";

type LocaleKey = "en" | "es";

const LOCALE_META: Record<LocaleKey, { flag: string; code: string }> = {
  en: { flag: "🇺🇸", code: "EN" },
  es: { flag: "🇪🇸", code: "ES" },
};

const LOCALES: readonly LocaleKey[] = ["en", "es"];

export type LanguageChipVariant = "pill" | "bare";

export function LanguageChip({ variant = "pill" }: { variant?: LanguageChipVariant } = {}) {
  const t = useTranslations("LANGUAGE_CHIP_COPY");
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const [confirmOpen, setConfirmOpen] = useState(false);
  // Locale staged by tapping a flag tile; committed by the Apply CTA.
  // Resets to the active locale every time the card opens.
  const [selected, setSelected] = useState<LocaleKey>(
    (locale as LocaleKey) in LOCALE_META ? (locale as LocaleKey) : "en",
  );

  const current = LOCALE_META[(locale as LocaleKey)] ?? LOCALE_META.en;

  function openCard() {
    setSelected((locale as LocaleKey) in LOCALE_META ? (locale as LocaleKey) : "en");
    setConfirmOpen(true);
  }

  function handleApply() {
    setConfirmOpen(false);
    // No-op when the staged locale matches the active one — avoids a
    // redundant hard navigation / reload.
    if (selected === locale) return;
    router.replace(pathname, { locale: selected });
  }

  return (
    <>
      {/* Two presentations, one behaviour. The confirm card gates the switch
          in both — only the trigger changes.

          `pill` (default, LEARN + the internal FULL hub): flag + locale code in
          the canonical HUD pill family, a peer of the Peones chip. Kept as the
          default on purpose so those two surfaces are untouched by this prop.

          `bare` (PLAY, founder 2026-08-30): text + chevron, no frame, no flag.
          It belongs to the header's ACCESS cluster — "things you can open" —
          and a framed pill there would read as WEALTH, which is the left zone's
          job. A language is a setting, not something you own, and the flag was
          also claiming country when what it selects is a language. */}
      {variant === "bare" ? (
        <button
          type="button"
          onClick={openCard}
          aria-label={t("ariaLabel")}
          data-testid="language-chip"
          className="hub-locale-bare"
        >
          <span>{current.code}</span>
          <span aria-hidden="true" className="hub-locale-bare-caret">
            ⌄
          </span>
        </button>
      ) : (
        <button
          type="button"
          onClick={openCard}
          aria-label={t("ariaLabel")}
          data-testid="language-chip"
          className="candy-tray-pill hub-hud-pill hub-hud-pill--anchored-left"
        >
          <span
            aria-hidden="true"
            className="candy-tray-pill-icon candy-tray-pill-icon--floating"
            style={{ fontSize: "1.5rem", lineHeight: 1 }}
          >
            {current.flag}
          </span>
          <span>{current.code}</span>
        </button>
      )}

      {confirmOpen ? (
        <VictoryPopupShell
          onClose={() => setConfirmOpen(false)}
          ariaLabel={t("dialogAriaLabel")}
          closeLabel={t("closeLabel")}
          // Portalled to `document.body` because this chip lives INSIDE the
          // hub's HUD header, and `.hub-home-scaffold > *` gives every direct
          // child `position: relative; z-index: 1`. That makes the header a
          // stacking context at z-1: rendered in place, the card's z-70 is
          // capped there and the mascot (z-2) and the panels below it paint
          // straight over the dialog. Both hubs wear that scaffold, so this is
          // one fix for LEARN and PLAY.
          portal
        >
          <h2 className="language-modal-title">{t("title")}</h2>
          <div
            className="language-tile-row"
            role="radiogroup"
            aria-label={t("dialogAriaLabel")}
          >
            {LOCALES.map((loc) => {
              const isSelected = loc === selected;
              return (
                <button
                  key={loc}
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  aria-label={t("selectAriaFormat", { language: t(loc) })}
                  data-testid={`language-tile-${loc}`}
                  onClick={() => setSelected(loc)}
                  className={`language-tile${isSelected ? " is-selected" : ""}`}
                >
                  <span aria-hidden="true" className="language-tile-flag">
                    {LOCALE_META[loc].flag}
                  </span>
                  <span className="language-tile-name">{t(loc)}</span>
                </button>
              );
            })}
          </div>
          <PrincipalButton
            onClick={handleApply}
            data-testid="language-chip-confirm"
            aria-label={t("apply")}
            className="self-center"
          >
            {t("apply")}
          </PrincipalButton>
        </VictoryPopupShell>
      ) : null}
    </>
  );
}
