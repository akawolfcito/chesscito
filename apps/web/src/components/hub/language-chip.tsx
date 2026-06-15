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

const LOCALE_META: Record<string, { flag: string; code: string }> = {
  en: { flag: "🇺🇸", code: "EN" },
  es: { flag: "🇪🇸", code: "ES" },
};

export function LanguageChip() {
  const t = useTranslations("LANGUAGE_CHIP_COPY");
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const current = LOCALE_META[locale] ?? LOCALE_META.en;
  const otherLocale = locale === "es" ? "en" : "es";
  const other = LOCALE_META[otherLocale];

  function handleSwitch() {
    setConfirmOpen(false);
    router.replace(pathname, { locale: otherLocale });
  }

  return (
    <>
      {/* Flag + locale code chip (founder 2026-06-15): the bare-flag
          treatment is retired so the language affordance reads as a peer
          of the trophy / Peones chips. Same canonical HUD pill family
          (candy-tray-pill + hub-hud-pill + anchored-left): flag in the
          floating-icon slot, locale code in the value slot. The confirm
          card still gates the switch. */}
      <button
        type="button"
        onClick={() => setConfirmOpen(true)}
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

      {confirmOpen ? (
        <div
          className="candy-modal-scrim fixed inset-0 z-[70] flex items-center justify-center animate-in fade-in duration-200"
          role="dialog"
          aria-modal="true"
          aria-label={t("dialogAriaLabel")}
          onClick={() => setConfirmOpen(false)}
        >
          <div
            className="mx-6 flex w-full max-w-[280px] flex-col items-center gap-3 rounded-2xl border border-amber-800/20 bg-[rgba(255,247,230,0.98)] p-4 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <p
              className="text-center text-sm font-bold"
              style={{ color: "rgba(63, 34, 8, 0.95)" }}
            >
              {t("question", { language: other.flag + " " + t(otherLocale) })}
            </p>
            <button
              type="button"
              onClick={handleSwitch}
              data-testid="language-chip-confirm"
              className="candy-tray-pill w-full justify-center py-2 text-sm font-bold"
              style={{ color: "rgba(63, 34, 8, 0.95)" }}
            >
              {other.flag} {t("confirm")}
            </button>
            <button
              type="button"
              onClick={() => setConfirmOpen(false)}
              className="arena-result-secondary-action"
            >
              {t("cancel")}
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
