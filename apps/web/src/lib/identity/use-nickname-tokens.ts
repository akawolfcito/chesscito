import { useMemo } from "react";
import { useTranslations } from "next-intl";
import type { NicknameTokens } from "./identity-lite";
import {
  nicknameTokensFromTranslator,
  type NicknameTranslator,
} from "./nickname-tokens";

/**
 * Builds the locale-aware `NicknameTokens` from the next-intl `IDENTITY_COPY`
 * namespace. Memoized per locale so the identity hooks/components get a stable
 * reference. Server callers use `nicknameTokensFromTranslator` with
 * `getTranslations`. Spec: docs/specs/identity-lite-pr1.md
 */
export function useNicknameTokens(): NicknameTokens {
  const t = useTranslations("IDENTITY_COPY");
  return useMemo(
    () => nicknameTokensFromTranslator(t as unknown as NicknameTranslator),
    [t],
  );
}
