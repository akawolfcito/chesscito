import type { TierKey } from "@/lib/profile/compute-tier";

type Props = {
  tier: TierKey;
  title: string;
  xp: number;
  /** Pre-formatted ARIA label. Parents own the ICU template (e.g.
   *  `t("tierAriaFormat", { title, xp })`) so the primitive stays
   *  decoupled from the i18n bundle. */
  ariaLabel?: string;
};

export function TierBadge({ tier, title, xp, ariaLabel }: Props) {
  return (
    <div
      className="profile-tier-badge"
      data-tier={tier}
      aria-label={ariaLabel ?? `Tier ${title}, ${xp} XP`}
    >
      <span className="profile-tier-badge-title">{title}</span>
      <strong className="profile-tier-badge-xp">{xp}</strong>
    </div>
  );
}
