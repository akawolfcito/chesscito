import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { isVisitor, resolveDisplayName } from "@/lib/profile/display-name";
import {
  deriveAvatarVariant,
  formatNickname,
  type AvatarVariant,
} from "@/lib/identity/identity-lite";
import { useNicknameTokens } from "@/lib/identity/use-nickname-tokens";

const KEY_PREFIX = "chesscito:display-name:";

export const displayNameStorageKey = (address: `0x${string}`): string =>
  `${KEY_PREFIX}${address.toLowerCase()}`;

export function useDisplayName(address: `0x${string}` | undefined) {
  const t = useTranslations("DISPLAY_NAME_COPY");
  const tokens = useNicknameTokens();
  const [customName, setCustomName] = useState<string | undefined>(undefined);

  // Identity Lite: deterministic avatar variant + generated nickname derived
  // from the wallet. The nickname replaces the truncated wallet as the default
  // display name (an explicit custom name still wins). Spec: identity-lite-pr1.
  const variant: AvatarVariant | undefined = useMemo(
    () => (address ? deriveAvatarVariant(address.toLowerCase()) : undefined),
    [address],
  );
  const generatedNickname = useMemo(
    () => (variant ? formatNickname(variant, tokens) : undefined),
    [variant, tokens],
  );

  useEffect(() => {
    if (!address) {
      setCustomName(undefined);
      return;
    }
    try {
      const stored = window.localStorage.getItem(displayNameStorageKey(address));
      setCustomName(stored ?? undefined);
    } catch {
      setCustomName(undefined);
    }
  }, [address]);

  const setName = useCallback(
    (newName: string) => {
      if (!address) return;
      const trimmed = newName.trim();
      try {
        if (trimmed) {
          window.localStorage.setItem(displayNameStorageKey(address), trimmed);
          setCustomName(trimmed);
        } else {
          window.localStorage.removeItem(displayNameStorageKey(address));
          setCustomName(undefined);
        }
      } catch {
        /* swallow */
      }
    },
    [address],
  );

  return {
    // Locale-aware visitor fallback — the resolved `name` localizes
    // per request so /es no longer renders "Visitor" in a Spanish UI.
    // generatedNickname replaces the truncated wallet as the default.
    name: resolveDisplayName(
      { address, customName, generatedNickname },
      t("visitor"),
    ),
    setName,
    /** Deterministic avatar variant for the connected wallet (undefined when
     *  no wallet). Consumers pair it with `<PlayerAvatar>`. */
    variant,
    // Boolean sentinel — use this instead of `name === "Visitor"` so
    // the check survives locale switches.
    isVisitor: isVisitor({ address, customName }),
    // Raw explicit custom name (undefined when none set). Consumers that
    // resolve their own fallback (e.g. Identity Lite generated nickname on
    // the leaderboard own-row) use this to know whether to override.
    customName,
  };
}
