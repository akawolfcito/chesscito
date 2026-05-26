"use client";

import { useTranslations } from "next-intl";

import { CandyIcon } from "@/components/redesign/candy-icon";

type Props = {
  isPro: boolean;
  credits: number;
  onPress: () => void;
};

function resolveStatusKey(isPro: boolean, credits: number) {
  if (isPro) return "coachStatusActive" as const;
  if (credits > 0) return "coachStatusFree" as const;
  return "coachStatusEmpty" as const;
}

export function AccountCoachRow({ isPro, credits, onPress }: Props) {
  const t = useTranslations("ACCOUNT_SHEET_COPY");
  const label = t("coachRowLabel");
  const statusKey = resolveStatusKey(isPro, credits);
  const statusLabel = t(statusKey);
  const tone = isPro ? "active" : credits > 0 ? "celo" : "inactive";

  return (
    <button
      type="button"
      onClick={onPress}
      aria-label={label}
      className="candy-tray flex w-full items-center gap-2.5 text-left transition active:scale-[0.98] !py-1.5 !px-2.5"
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center">
        <CandyIcon name="coach" className="h-7 w-7" />
      </span>
      <span
        className="flex-1 text-sm font-bold"
        style={{ color: "rgba(63, 34, 8, 0.95)" }}
      >
        {label}
      </span>
      <span className="account-status-pill" data-tone={tone}>
        {statusLabel}
      </span>
    </button>
  );
}
