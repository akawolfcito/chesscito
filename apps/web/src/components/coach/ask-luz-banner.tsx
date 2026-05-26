"use client";

import { useTranslations } from "next-intl";

import { CandyIcon } from "@/components/redesign/candy-icon";

type Props = {
  onPress: () => void;
};

export function AskLuzBanner({ onPress }: Props) {
  const t = useTranslations("COACH_COPY");
  const title = t("historyAskNextTitle");
  const sub = t("historyAskNextSub");

  return (
    <button
      type="button"
      onClick={onPress}
      aria-label={title}
      className="flex w-full items-center gap-3 rounded-2xl border border-[rgba(217,180,74,0.55)] bg-gradient-to-br from-[rgba(255,240,200,0.85)] to-[rgba(245,158,11,0.18)] px-4 py-3 text-left shadow-[0_2px_0_rgba(110,65,15,0.18)] transition-transform active:scale-[0.99]"
    >
      <span className="relative flex h-10 w-10 shrink-0 items-center justify-center">
        <span className="absolute h-10 w-10 animate-pulse rounded-full bg-[radial-gradient(circle,rgba(245,158,11,0.28)_0%,rgba(217,180,74,0.12)_55%,transparent_80%)]" />
        <CandyIcon name="coach" className="relative h-7 w-7" />
      </span>
      <span className="flex min-w-0 flex-col">
        <span
          className="text-sm font-extrabold leading-tight"
          style={{ color: "rgba(110, 65, 15, 0.92)" }}
        >
          {title}
        </span>
        <span
          className="text-xs leading-snug"
          style={{ color: "rgba(110, 65, 15, 0.72)" }}
        >
          {sub}
        </span>
      </span>
    </button>
  );
}
