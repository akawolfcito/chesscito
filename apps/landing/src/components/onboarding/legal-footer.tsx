import { LEGAL_URL } from "@/lib/app-urls";
import { LocaleSwitch } from "@/components/onboarding/locale-switch";

function Dot() {
  return <span aria-hidden="true" className="inline-block h-1 w-1 rounded-full bg-current opacity-60" />;
}

export function LegalFooter({
  privacyLabel,
  termsLabel,
  supportLabel,
}: {
  privacyLabel: string;
  termsLabel: string;
  supportLabel: string;
}) {
  return (
    // The language switch rides here rather than in the top row: that row is
    // symmetrical navigation (back · counter · forward) and a fourth element
    // unbalances it. Down here it sits with the other things you change rather
    // than the things you press to move on.
    <div
      className="flex items-center justify-center gap-2 text-sm font-bold text-white"
      style={{ textShadow: "0 1px 2px rgba(0, 0, 0, 0.65)" }}
    >
      <a href={`${LEGAL_URL}/privacy`}>{privacyLabel}</a>
      <Dot />
      <a href={`${LEGAL_URL}/terms`}>{termsLabel}</a>
      <Dot />
      <a href={`${LEGAL_URL}/support`}>{supportLabel}</a>
      <LocaleSwitch />
    </div>
  );
}
