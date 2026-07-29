import { useTranslations } from "next-intl";
import { CandyIcon } from "@/components/redesign/candy-icon";

/**
 * The count comes from `onboarding.progress`. That key already existed and the
 * component ignored it, hardcoding "{current} / {total}" instead — which made
 * the counter the one string on screen that could not be translated. Spanish
 * reads "1 de 4".
 */
export function ProgressPill({ current, total }: { current: number; total: number }) {
  const t = useTranslations("onboarding");
  return (
    <div className="onboarding-progress-pill">
      <CandyIcon name="star" className="onboarding-progress-star" />
      <span>{t("progress", { current, total })}</span>
    </div>
  );
}
