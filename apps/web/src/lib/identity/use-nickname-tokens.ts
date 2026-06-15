import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { PIECES, STYLES, type NicknameTokens } from "./identity-lite";

/**
 * Builds the locale-aware `NicknameTokens` from the next-intl `IDENTITY_COPY`
 * namespace. Memoized per locale so the identity hooks/components get a stable
 * reference. Spec: docs/specs/identity-lite-pr1.md
 */
export function useNicknameTokens(): NicknameTokens {
  const t = useTranslations("IDENTITY_COPY");
  return useMemo(() => {
    const pieces = Object.fromEntries(
      PIECES.map((p) => [p, t(`pieces.${p}`)]),
    ) as NicknameTokens["pieces"];
    const styles = Object.fromEntries(
      STYLES.map((s) => [s, t(`styles.${s}`)]),
    ) as NicknameTokens["styles"];
    return {
      pieces,
      styles,
      guestPrefix: t("guestPrefix"),
      // `t.raw` bypasses ICU parsing — the template contains literal
      // `{style}`/`{piece}`/`{number}` braces that formatNickname fills itself,
      // which next-intl would otherwise try to resolve as ICU arguments.
      template: t.raw("template") as string,
    };
    // `t` is stable per locale in next-intl.
  }, [t]);
}
