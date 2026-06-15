import { DISPLAY_NAME_COPY } from "@/lib/content/editorial";

export function truncateWallet(address: `0x${string}` | undefined): string {
  if (!address) return "";
  if (address.length < 10) return address;
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export type ResolveDisplayNameArgs = {
  address: `0x${string}` | undefined;
  customName?: string;
  talentProtocolName?: string;
  /**
   * Identity Lite generated nickname (e.g. "Golden Knight #4821"). When present
   * it replaces the truncated wallet as the wallet-backed default. Omitting it
   * preserves the legacy truncate-wallet behavior. Spec: identity-lite-pr1.
   */
  generatedNickname?: string;
};

/**
 * Resolves a display name from (in order of precedence): custom name >
 * Talent Protocol name > generated nickname > truncated wallet > localized
 * visitor fallback.
 *
 * `visitorLabel` is parameterized so callers can pass the locale-aware
 * value from the i18n bundle (next-intl `t("visitor")`). Default keeps
 * the EN literal "Visitor" so legacy callers + unit tests stay green
 * without changes.
 */
export function resolveDisplayName(
  args: ResolveDisplayNameArgs,
  visitorLabel: string = DISPLAY_NAME_COPY.visitor,
): string {
  if (!args.address) return visitorLabel;
  const trimmedCustom = args.customName?.trim();
  if (trimmedCustom) return trimmedCustom;
  const trimmedTalent = args.talentProtocolName?.trim();
  if (trimmedTalent) return trimmedTalent;
  const trimmedGenerated = args.generatedNickname?.trim();
  if (trimmedGenerated) return trimmedGenerated;
  return truncateWallet(args.address);
}

/**
 * Locale-agnostic boolean for "is this user effectively anonymous?".
 * Use this instead of comparing the resolved display name to the
 * literal "Visitor" — the latter breaks the moment ES (or any other
 * locale) returns a translated visitor label.
 */
export function isVisitor(args: ResolveDisplayNameArgs): boolean {
  return !args.address;
}
