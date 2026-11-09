import { useEffect, useState } from "react";
import {
  deriveAvatarVariant,
  formatGuestNickname,
  type AvatarVariant,
} from "./identity-lite";
import { getOrCreateGuestId, guestSeed } from "./guest-id";
import { useNicknameTokens } from "./use-nickname-tokens";

export type GuestIdentity = {
  variant: AvatarVariant;
  name: string;
};

/**
 * Deterministic local identity for users WITHOUT a wallet. Client-gated: returns
 * `null` until mounted so the server / first paint renders a stable placeholder
 * (avoids a hydration mismatch — the guest id lives in localStorage). After
 * mount it yields a stable guest avatar + nickname ("Guest <Piece> #NNNN").
 * Spec: docs/specs/identity-lite-pr1.md
 */
export function useGuestIdentity(): GuestIdentity | null {
  const tokens = useNicknameTokens();
  const [id, setId] = useState<string | null>(null);

  useEffect(() => {
    setId(getOrCreateGuestId());
  }, []);

  if (!id) return null;
  const variant = deriveAvatarVariant(guestSeed(id));
  return { variant, name: formatGuestNickname(variant, tokens) };
}
