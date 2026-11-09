"use client";
import { useTranslations } from "next-intl";
import { TierBadge } from "@/components/profile/tier-badge";
import type { TierKey } from "@/lib/profile/compute-tier";
import { PlayerAvatar } from "@/components/identity/player-avatar";
import type { AvatarVariant } from "@/lib/identity/identity-lite";

type Props = {
  displayName: string;
  /** Identity Lite avatar variant for the connected wallet. Omitted for the
   *  visitor/no-wallet case → falls back to the wizard emoji. */
  variant?: AvatarVariant;
  tierTitle: string;
  tierKey: TierKey;
  xp: number;
  truncatedWallet: string;
  onEditName: () => void;
};

export function ProfileBanner({
  displayName,
  variant,
  tierTitle,
  tierKey,
  xp,
  truncatedWallet,
  onEditName,
}: Props) {
  const t = useTranslations("PROFILE_COPY");
  return (
    <header className="profile-banner">
      <div className="profile-banner-avatar-wrap">
        {variant ? (
          <PlayerAvatar variant={variant} size="lg" />
        ) : (
          <span className="profile-banner-avatar" aria-hidden="true">
            🧙
          </span>
        )}
      </div>
      <div className="profile-banner-meta">
        <div className="profile-banner-name-row">
          <span className="profile-banner-name">{displayName}</span>
          <button
            type="button"
            onClick={onEditName}
            aria-label={t("editNameAria")}
            className="profile-banner-edit-pen"
          >
            ✏️
          </button>
        </div>
        <div className="profile-banner-wallet">{truncatedWallet}</div>
      </div>
      <div className="profile-banner-badge-slot">
        <TierBadge
          tier={tierKey}
          title={tierTitle}
          xp={xp}
          ariaLabel={t("tierAriaFormat", { title: tierTitle, xp })}
        />
      </div>
    </header>
  );
}
