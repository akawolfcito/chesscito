"use client";
import { useTranslations } from "next-intl";

type Props = { onPress: () => void };

export function SecondaryCta({ onPress }: Props) {
  const t = useTranslations("SECONDARY_CTA_COPY");
  return (
    <button
      type="button"
      onClick={onPress}
      aria-label={t("arena.ariaLabel")}
      className="hub-secondary-cta"
    >
      {t("arena.label")} <span aria-hidden="true">→</span>
    </button>
  );
}
