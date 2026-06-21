"use client";

import { useTranslations } from "next-intl";
import { CandyIcon } from "@/components/redesign/candy-icon";

type Props = {
  onContinue: () => void;
};

export function FirstFocusDayOverlay({ onContinue }: Props) {
  const t = useTranslations("FIRST_FOCUS_DAY_OVERLAY_COPY");

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center"
      style={{ background: "rgba(30, 15, 5, 0.78)" }}
      data-testid="first-focus-day-overlay"
    >
      <div
        className="relative mx-4 flex w-full max-w-[340px] flex-col items-center gap-4 rounded-2xl px-6 py-8 text-center shadow-2xl"
        style={{ background: "rgba(255, 248, 235, 0.98)" }}
      >
        {/* Achievement icon */}
        <div
          className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-amber-400/50"
          style={{ background: "rgba(245, 158, 11, 0.12)" }}
        >
          <CandyIcon
            name="star"
            className="h-8 w-8 text-amber-500 drop-shadow-[0_0_8px_rgba(245,158,11,0.5)]"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <p
            className="text-xs font-black uppercase tracking-[0.18em]"
            style={{ color: "rgba(63, 34, 8, 0.45)" }}
          >
            {t("eyebrow")}
          </p>
          <h2
            className="text-2xl font-extrabold leading-tight"
            style={{ color: "rgba(63, 34, 8, 0.95)" }}
          >
            {t("title")}
          </h2>
          <p
            className="text-sm font-medium leading-relaxed"
            style={{ color: "rgba(63, 34, 8, 0.60)" }}
          >
            {t("description")}
          </p>
        </div>

        <button
          type="button"
          onClick={onContinue}
          className="principal-button principal-button-medium w-full"
        >
          <span className="principal-button-label">{t("continueCta")}</span>
        </button>
      </div>
    </div>
  );
}
