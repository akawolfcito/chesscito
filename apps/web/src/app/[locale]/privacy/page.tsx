import { LegalPageShell } from "@/components/legal-page-shell";
import { CandyIcon } from "@/components/redesign/candy-icon";
import { LEGAL_COPY, PRIVACY_COACH_COPY } from "@/lib/content/editorial";

export const metadata = {
  title: "Privacy Policy — Chesscito",
  description: "Privacy Policy for Chesscito, an educational pre-chess game on Celo.",
};

export default function PrivacyPage() {
  const { title, lastUpdated, sections } = LEGAL_COPY.privacy;

  return (
    <LegalPageShell title={title}>
      <div className="flex items-center gap-2">
        <CandyIcon name="fingerprint" className="h-5 w-5" />
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
      <section>
        <h2
          className="mb-2 text-sm font-bold"
          style={{ color: "var(--paper-text)" }}
        >
          {PRIVACY_COACH_COPY.heading}
        </h2>
        <p style={{ color: "var(--paper-text-muted)" }}>{PRIVACY_COACH_COPY.para1}</p>
        <p className="mt-3" style={{ color: "var(--paper-text-muted)" }}>
          <strong style={{ color: "var(--paper-text)" }}>{PRIVACY_COACH_COPY.para2Title}</strong>{" "}
          {PRIVACY_COACH_COPY.para2}
        </p>
        <p className="mt-3" style={{ color: "var(--paper-text-muted)" }}>
          <strong style={{ color: "var(--paper-text)" }}>{PRIVACY_COACH_COPY.para3Title}</strong>{" "}
          {PRIVACY_COACH_COPY.para3}
        </p>
        <p className="mt-3" style={{ color: "var(--paper-text-muted)" }}>
          <strong style={{ color: "var(--paper-text)" }}>{PRIVACY_COACH_COPY.para4Title}</strong>{" "}
          {PRIVACY_COACH_COPY.para4}
        </p>
      </section>
    </LegalPageShell>
  );
}
