import { getTranslations } from "next-intl/server";
import { LegalPageShell } from "@/components/legal-page-shell";
import { CandyIcon } from "@/components/redesign/candy-icon";

export const metadata = {
  title: "Terms of Service — Chesscito",
  description: "Terms of Service for Chesscito, an educational pre-chess game on Celo.",
};

export default async function TermsPage() {
  const tLegal = await getTranslations("LEGAL_COPY.terms");
  const tShell = await getTranslations("LEGAL_SHELL_COPY");
  const sections = tLegal.raw("sections") as { heading: string; body: string }[];

  return (
    <LegalPageShell title={tLegal("title")}>
      <div className="flex items-center gap-2">
        <CandyIcon name="lock" className="h-5 w-5" />
        <p className="text-xs" style={{ color: "var(--paper-text-subtle)" }}>
          {tShell("lastUpdatedLabel")}: {tLegal("lastUpdated")}
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
