"use client";
import { TierBadge } from "@/components/profile/tier-badge";
import type { TierKey } from "@/lib/profile/compute-tier";

type Props = {
  displayName: string;
  tierTitle: string;
  tierKey: TierKey;
  xp: number;
  truncatedWallet: string;
  onEditName: () => void;
};

export function ProfileBanner({
  displayName,
  tierTitle,
  tierKey,
  xp,
  truncatedWallet,
  onEditName,
}: Props) {
  return (
    <header className="profile-banner">
      <div className="profile-banner-avatar-wrap">
        <span className="profile-banner-avatar" aria-hidden="true">
          🧙
        </span>
      </div>
      <div className="profile-banner-meta">
        <div className="profile-banner-name-row">
          <span className="profile-banner-name">{displayName}</span>
          <button
            type="button"
            onClick={onEditName}
            aria-label="Edit display name"
            className="profile-banner-edit-pen"
          >
            ✏️
          </button>
        </div>
        <div className="profile-banner-wallet">{truncatedWallet}</div>
      </div>
      <div className="profile-banner-badge-slot">
        <TierBadge tier={tierKey} title={tierTitle} xp={xp} />
      </div>
    </header>
  );
}
