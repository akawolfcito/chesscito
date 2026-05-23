import { LegalPageShell } from "@/components/legal-page-shell";
import { CandyIcon } from "@/components/redesign/candy-icon";
import { LEGAL_COPY } from "@/lib/content/editorial";

export const metadata = {
  title: "Terms of Service — Chesscito",
  description: "Terms of Service for Chesscito, an educational pre-chess game on Celo.",
};

export default function TermsPage() {
  const { title, lastUpdated, sections } = LEGAL_COPY.terms;

  return (
    <LegalPageShell title={title}>
      <div className="flex items-center gap-2">
        <CandyIcon name="lock" className="h-5 w-5" />
        <p className="text-xs" style={{ color: "var(--paper-text-subtle)" }}>
          Last updated: {lastUpdated}
        </p>
      </div>
      {sections.map((section) => (
        <section key={section.heading}>
          <h2
            className="mb-2 text-sm font-bold"
            style={{ color: "var(--paper-text)" }}
          >
            {section.heading}
          </h2>
          <p style={{ color: "var(--paper-text-muted)" }}>{section.body}</p>
        </section>
      ))}
    </LegalPageShell>
  );
}
