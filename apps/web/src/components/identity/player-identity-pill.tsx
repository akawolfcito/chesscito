import * as React from "react";
import { cn } from "@/lib/utils";
import type { AvatarVariant } from "@/lib/identity/identity-lite";
import { PlayerAvatar } from "./player-avatar";
import type { AvatarSize } from "./avatar-style";

export type PlayerIdentityPillProps = {
  variant: AvatarVariant;
  /** Already-resolved display name (custom > generated). */
  name: string;
  size?: AvatarSize;
  className?: string;
};

/**
 * Compact avatar + nickname unit. The pill owns the accessible label (the
 * nickname); the inner avatar is decorative. Spec: identity-lite-pr1.
 */
export function PlayerIdentityPill({
  variant,
  name,
  size = "md",
  className,
}: PlayerIdentityPillProps): React.JSX.Element {
  return (
    <span
      aria-label={name}
      className={cn("player-identity-pill", className)}
    >
      <PlayerAvatar variant={variant} size={size} alt="" />
      <span className="player-identity-pill-name" aria-hidden>
        {name}
      </span>
    </span>
  );
}
