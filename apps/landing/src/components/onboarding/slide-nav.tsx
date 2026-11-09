import { useTranslations } from "next-intl";
import { CandyIcon } from "@/components/redesign/candy-icon";
import { ProgressPill } from "@/components/onboarding/progress-pill";

/**
 * Reuses the shared `chevron-down` asset rotated ±90deg instead of adding
 * dedicated left/right icon files (no canonical chevron-left/right asset
 * exists yet).
 *
 * `disabled:opacity-0` at the ends: the button goes invisible rather than
 * dimmed, but stays disabled in the DOM, so it never takes focus.
 */
export function SlideNav({
  step,
  total,
  onBack,
  onForward,
}: {
  step: number;
  total: number;
  onBack: () => void;
  onForward: () => void;
}) {
  const t = useTranslations("onboarding.nav");

  return (
    <div
      className="flex w-full items-center justify-between gap-2 px-1"
      role="group"
      aria-label={t("regionLabel")}
    >
      <button
        type="button"
        onClick={onBack}
        disabled={step <= 1}
        aria-label={t("previous")}
        className="onboarding-nav-arrow"
      >
        <CandyIcon name="chevron-down" className="h-4 w-4 rotate-90" />
      </button>
      <ProgressPill current={step} total={total} />
      <button
        type="button"
        onClick={onForward}
        disabled={step >= total}
        aria-label={t("next")}
        className="onboarding-nav-arrow"
      >
        <CandyIcon name="chevron-down" className="h-4 w-4 -rotate-90" />
      </button>
    </div>
  );
}
