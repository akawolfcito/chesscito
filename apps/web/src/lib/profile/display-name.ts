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
};

export function resolveDisplayName(args: ResolveDisplayNameArgs): string {
  if (!args.address) return DISPLAY_NAME_COPY.visitor;
  const trimmedCustom = args.customName?.trim();
  if (trimmedCustom) return trimmedCustom;
  const trimmedTalent = args.talentProtocolName?.trim();
  if (trimmedTalent) return trimmedTalent;
  return truncateWallet(args.address);
}
