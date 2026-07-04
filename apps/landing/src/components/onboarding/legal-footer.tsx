import { LEGAL_URL } from "@/lib/app-urls";

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
    <div className="flex items-center justify-center gap-2 text-sm font-bold text-[#3a2600]">
      <a href={`${LEGAL_URL}/privacy`}>{privacyLabel}</a>
      <Dot />
      <a href={`${LEGAL_URL}/terms`}>{termsLabel}</a>
      <Dot />
      <a href={`${LEGAL_URL}/support`}>{supportLabel}</a>
    </div>
  );
}
