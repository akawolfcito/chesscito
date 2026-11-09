"use client";

import { useTranslations } from "next-intl";

import { CandyIcon } from "@/components/redesign/candy-icon";
import { Button } from "@/components/ui/button";

type Props = {
  onClick: () => void;
  className?: string;
};

/**
 * Tertiary "Ask Coach" CTA — compact, emerald gradient, single-line
 * label. Demoted from full-width primary in Sprint 4A so it stops
 * competing with PrincipalButton; the coach mascot tone (emerald)
 * is preserved as a unique identity. Parents control width via
 * `className` (e.g., flex-1 inline, w-full standalone).
 */
export function AskCoachButton({ onClick, className = "w-full" }: Props) {
  const t = useTranslations("COACH_COPY");
  return (
    <Button
      type="button"
      variant="game-solid"
      size="game-sm"
      onClick={onClick}
      className={`${className} border-emerald-700/40 bg-gradient-to-b from-emerald-500 to-emerald-600 text-white hover:from-emerald-400 hover:to-emerald-500 shadow-[0_2px_0_rgba(6,78,59,0.45)]`}
    >
      <CandyIcon name="coach" className="inline h-4 w-4" />
      <span className="font-bold tracking-wide drop-shadow-[0_1px_0_rgba(0,0,0,0.35)]">
        {t("askCoach")}
      </span>
    </Button>
  );
}
