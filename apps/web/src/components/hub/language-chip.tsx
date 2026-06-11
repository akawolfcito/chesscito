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
      {/* Bare flag button (founder 2026-06-11): no pill, no medallion,
          no locale code — the flag alone is the affordance, sized to
          match the chip sprites. The confirm card still gates the
          switch. */}
      <button
        type="button"
        onClick={() => setConfirmOpen(true)}
        aria-label={t("ariaLabel")}
        data-testid="language-chip"
        className="flex h-9 w-9 items-center justify-center text-[1.75rem] leading-none transition-transform active:scale-95"
        style={{ filter: "drop-shadow(0 2px 3px rgba(120, 65, 5, 0.35))" }}
      >
        <span aria-hidden="true">{current.flag}</span>
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
