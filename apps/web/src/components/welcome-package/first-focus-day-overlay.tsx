"use client";

import { useTranslations } from "next-intl";
import { VictoryPopupShell } from "@/components/arena/victory-popup-shell";
import { PrincipalButton } from "@/components/scene-rooted/principal-button";
import { ThemeAssetPicture } from "@/components/themes/theme-asset-picture";

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
        <ThemeAssetPicture slot="welcome.achievement-1day" pictureClassName="mx-auto block" alt={t("title")} className="mx-auto h-28 w-28 object-contain" draggable={false} />

        <div className="flex w-full flex-col items-center gap-1 text-center">
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

        <PrincipalButton onClick={onContinue} className="self-center">
          {t("continueCta")}
        </PrincipalButton>
      </VictoryPopupShell>
    </div>
  );
}
