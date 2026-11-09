import { getTranslations } from "next-intl/server";
import { LegalPageShell } from "@/components/legal-page-shell";
import { CandyIcon } from "@/components/redesign/candy-icon";

export const metadata = {
  title: "Privacy Policy — Chesscito",
  description: "Privacy Policy for Chesscito, an educational pre-chess game on Celo.",
};

export default async function PrivacyPage() {
  const tLegal = await getTranslations("LEGAL_COPY.privacy");
  const tCoach = await getTranslations("PRIVACY_COACH_COPY");
  const tShell = await getTranslations("LEGAL_SHELL_COPY");
  const sections = tLegal.raw("sections") as { heading: string; body: string }[];

  return (
    <LegalPageShell title={tLegal("title")}>
      <div className="flex items-center gap-2">
        <CandyIcon name="fingerprint" className="h-5 w-5" />
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
      <section>
        <h2
          className="mb-2 text-sm font-bold"
          style={{ color: "var(--paper-text)" }}
        >
          {tCoach("heading")}
        </h2>
        <p style={{ color: "var(--paper-text-muted)" }}>{tCoach("para1")}</p>
        <p className="mt-3" style={{ color: "var(--paper-text-muted)" }}>
          <strong style={{ color: "var(--paper-text)" }}>{tCoach("para2Title")}</strong>{" "}
          {tCoach("para2")}
        </p>
        <p className="mt-3" style={{ color: "var(--paper-text-muted)" }}>
          <strong style={{ color: "var(--paper-text)" }}>{tCoach("para3Title")}</strong>{" "}
          {tCoach("para3")}
        </p>
        <p className="mt-3" style={{ color: "var(--paper-text-muted)" }}>
          <strong style={{ color: "var(--paper-text)" }}>{tCoach("para4Title")}</strong>{" "}
          {tCoach("para4")}
        </p>
      </section>
    </LegalPageShell>
  );
}
