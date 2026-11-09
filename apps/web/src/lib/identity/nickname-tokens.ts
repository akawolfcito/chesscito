import { PIECES, STYLES, type NicknameTokens } from "./identity-lite";

/** Minimal translator shape shared by next-intl's client `useTranslations`
 *  and server `getTranslations` — both are callable and expose `.raw`. */
export type NicknameTranslator = {
  (key: string): string;
  raw: (key: string) => unknown;
};

/**
 * Builds locale-aware `NicknameTokens` from an `IDENTITY_COPY`-scoped
 * translator. Isomorphic: the client hook and the server stats page both call
 * this. `raw` is used for the template because it contains literal
 * `{style}`/`{piece}`/`{number}` braces that formatNickname fills itself —
 * next-intl would otherwise try to resolve them as ICU arguments.
 * Spec: docs/specs/identity-lite-pr1.md
 */
export function nicknameTokensFromTranslator(
  t: NicknameTranslator,
): NicknameTokens {
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
    template: t.raw("template") as string,
  };
}
