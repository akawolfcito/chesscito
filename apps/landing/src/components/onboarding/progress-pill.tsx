import { useTranslations } from "next-intl";

/**
 * The count comes from `onboarding.progress`. That key already existed and the
 * component ignored it, hardcoding "{current} / {total}" instead — which made
 * the counter the one string on screen that could not be translated. Spanish
 * reads "1 de 4".
 *
 * No icon. The star briefly sat here to match the reference art, and it is the
 * currency the game pays out for exercises: spending it on "which slide am I
 * on" cheapens it everywhere it means something (founder, 2026-07-29).
 */
export function ProgressPill({ current, total }: { current: number; total: number }) {
  const t = useTranslations("onboarding");
  return (
    <div className="onboarding-progress-pill">{t("progress", { current, total })}</div>
  );
}
