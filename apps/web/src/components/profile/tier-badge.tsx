import type { TierKey } from "@/lib/profile/compute-tier";

type Props = {
  tier: TierKey;
  title: string;
  xp: number;
};

export function TierBadge({ tier, title, xp }: Props) {
  return (
    <div
      className="profile-tier-badge"
      data-tier={tier}
      aria-label={`Tier ${title}, ${xp} XP`}
    >
      <span className="profile-tier-badge-title">{title}</span>
      <strong className="profile-tier-badge-xp">{xp}</strong>
    </div>
  );
}
