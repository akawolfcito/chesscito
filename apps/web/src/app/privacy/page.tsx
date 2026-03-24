import { LegalPageShell } from "@/components/legal-page-shell";
import { LEGAL_COPY } from "@/lib/content/editorial";

export const metadata = {
  title: "Privacy Policy — Chesscito",
  description: "Privacy Policy for Chesscito, an educational pre-chess game on Celo.",
};

export default function PrivacyPage() {
  const { title, lastUpdated, sections } = LEGAL_COPY.privacy;

  return (
    <LegalPageShell title={title}>
      <p className="text-xs text-cyan-300/50">Last updated: {lastUpdated}</p>
      {sections.map((section) => (
        <section key={section.heading}>
          <h2 className="mb-2 text-sm font-semibold text-cyan-200">
            {section.heading}
          </h2>
          <p>{section.body}</p>
        </section>
      ))}
    </LegalPageShell>
  );
}
