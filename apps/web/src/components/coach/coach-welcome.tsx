"use client";

import { useTranslations } from "next-intl";

import { CandyIcon } from "@/components/redesign/candy-icon";

export function CoachWelcome() {
  const t = useTranslations("COACH_COPY");
  return (
    <div className="flex flex-col items-center gap-3 text-center">
      <div className="relative flex items-center justify-center">
        <div className="absolute h-20 w-20 animate-pulse rounded-full bg-[radial-gradient(circle,rgba(245,158,11,0.28)_0%,rgba(217,180,74,0.12)_50%,transparent_75%)]" />
        <CandyIcon name="coach" className="relative h-12 w-12" />
      </div>

      <p
        className="text-sm"
        style={{
          color: "rgba(110, 65, 15, 0.85)",
          textShadow: "0 1px 0 rgba(255, 245, 215, 0.55)",
        }}
      >
        {t("welcomeSub")}
      </p>

      {/* Value card with crossed-out price — gold candy-frame to emphasize the free offer. */}
      <div className="candy-frame candy-frame-gold w-full p-3">
        <div className="flex items-center justify-between">
          <div className="min-w-0 text-left">
            <p className="text-sm font-extrabold truncate">{t("welcomePack")}</p>
            <p className="mt-0.5 text-[0.7rem] leading-tight opacity-75">{t("welcomePackDetail")}</p>
          </div>
          <div className="flex shrink-0 flex-col items-end">
            <span className="text-xs line-through opacity-55">$0.05</span>
            <span className="text-base font-extrabold">FREE</span>
          </div>
        </div>
      </div>
    </div>
  );
}
