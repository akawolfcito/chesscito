import { useCallback, useEffect, useState } from "react";
import { resolveDisplayName } from "@/lib/profile/display-name";

const KEY_PREFIX = "chesscito:display-name:";

export const displayNameStorageKey = (address: `0x${string}`): string =>
  `${KEY_PREFIX}${address.toLowerCase()}`;

export function useDisplayName(address: `0x${string}` | undefined) {
  const [customName, setCustomName] = useState<string | undefined>(undefined);

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
    name: resolveDisplayName({ address, customName }),
    setName,
  };
}
