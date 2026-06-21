"use client";

import { useTranslations } from "next-intl";
import { VictoryPopupShell } from "@/components/arena/victory-popup-shell";
import { PrincipalButton } from "@/components/scene-rooted/principal-button";

type Props = {
  onContinue: () => void;
};

export function FirstFocusDayOverlay({ onContinue }: Props) {
  const t = useTranslations("FIRST_FOCUS_DAY_OVERLAY_COPY");

  return (
    <div data-testid="first-focus-day-overlay">
      <VictoryPopupShell
        ariaLabel={t("title")}
      >
        {/* Achievement badge image */}
        <div className="flex justify-center">
          <picture>
            <source srcSet="/art/achievements/1day-focus.avif" type="image/avif" />
            <source srcSet="/art/achievements/1day-focus.webp" type="image/webp" />
            <img
              src="/art/achievements/1day-focus.png"
              alt={t("title")}
              className="h-28 w-28 object-contain"
              draggable={false}
            />
          </picture>
        </div>

        <div className="flex flex-col items-center gap-1 text-center">
          <p
            className="text-xs font-black uppercase tracking-[0.18em]"
            style={{ color: "var(--popup-title-color)", opacity: 0.5 }}
          >
            {t("eyebrow")}
          </p>
          <h2 className="language-modal-title">{t("title")}</h2>
          <p
            className="text-sm font-medium leading-relaxed"
            style={{ color: "rgba(110, 65, 15, 0.70)" }}
          >
            {t("description")}
          </p>
        </div>

        <PrincipalButton onClick={onContinue} className="w-full">
          {t("continueCta")}
        </PrincipalButton>
      </VictoryPopupShell>
    </div>
  );
}
