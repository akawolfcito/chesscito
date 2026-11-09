import { getTranslations } from "next-intl/server";
import { LegalPageShell } from "@/components/legal-page-shell";
import { Mail, Github, Send } from "lucide-react";

export const metadata = {
  title: "Support — Chesscito",
  description: "Get help with Chesscito — report issues, ask questions, or request features.",
};

export default async function SupportPage() {
  const t = await getTranslations("SUPPORT_COPY");
  const reportable = t.raw("reportableIssues") as string[];
  const primaryHref = t.raw("primaryChannel.href") as string | undefined;

  return (
    <LegalPageShell title={t("title")}>
      {/* Primary channel */}
      <section>
        <h2 className="mb-3 text-sm font-bold" style={{ color: "var(--paper-text)" }}>
          {t("sections.contactUs")}
        </h2>
        {primaryHref ? (
          <a
            href={primaryHref}
            className="paper-tray flex min-h-[44px] items-center gap-3 transition active:scale-[0.99]"
            style={{ color: "var(--paper-text)" }}
          >
            <Mail size={18} className="shrink-0" style={{ color: "rgba(180, 110, 20, 0.95)" }} />
            <div>
              <p className="text-sm font-semibold">{t("primaryChannel.label")}</p>
              <p className="text-xs" style={{ color: "var(--paper-text-muted)" }}>
                {t("primaryChannel.value")}
              </p>
            </div>
          </a>
        ) : (
          <div
            className="paper-tray flex min-h-[44px] items-center gap-3 opacity-60"
            style={{ color: "var(--paper-text-muted)" }}
          >
            <Mail size={18} className="shrink-0 opacity-60" />
            <p className="text-sm font-semibold">{t("primaryChannel.unavailable")}</p>
          </div>
        )}
      </section>

      {/* Tertiary channel — Telegram community / DM */}
      <section>
        <h2 className="mb-3 text-sm font-bold" style={{ color: "var(--paper-text)" }}>
          {t("sections.community")}
        </h2>
        <a
          href={t("tertiaryChannel.href")}
          target="_blank"
          rel="noopener noreferrer"
          className="paper-tray flex min-h-[44px] items-center gap-3 transition active:scale-[0.99]"
          style={{ color: "var(--paper-text)" }}
        >
          <Send size={18} className="shrink-0" style={{ color: "rgba(180, 110, 20, 0.95)" }} />
          <div>
            <p className="text-sm font-semibold">{t("tertiaryChannel.label")}</p>
            <p className="text-xs" style={{ color: "var(--paper-text-muted)" }}>
              {t("tertiaryChannel.value")}
            </p>
          </div>
        </a>
      </section>

      {/* Secondary channel */}
      <section>
        <h2 className="mb-3 text-sm font-bold" style={{ color: "var(--paper-text)" }}>
          {t("sections.technicalIssues")}
        </h2>
        <a
          href={t("secondaryChannel.href")}
          target="_blank"
          rel="noopener noreferrer"
          className="paper-tray flex min-h-[44px] items-center gap-3 transition active:scale-[0.99]"
          style={{ color: "var(--paper-text)" }}
        >
          <Github size={18} className="shrink-0" style={{ color: "rgba(180, 110, 20, 0.95)" }} />
          <div>
            <p className="text-sm font-semibold">{t("secondaryChannel.label")}</p>
            <p className="text-xs" style={{ color: "var(--paper-text-muted)" }}>
              {t("secondaryChannel.value")}
            </p>
          </div>
        </a>
      </section>

      {/* How to report */}
      <section>
        <h2 className="mb-3 text-sm font-bold" style={{ color: "var(--paper-text)" }}>
          {t("sections.howToReport")}
        </h2>
        <p className="mb-3" style={{ color: "var(--paper-text-muted)" }}>{t("howToReport")}</p>
        <ul className="list-inside list-disc space-y-1" style={{ color: "var(--paper-text-muted)" }}>
          {reportable.map((issue) => (
            <li key={issue}>{issue}</li>
          ))}
        </ul>
      </section>

      {/* Response time */}
      <section>
        <p className="text-xs" style={{ color: "var(--paper-text-subtle)" }}>{t("responseTime")}</p>
      </section>
    </LegalPageShell>
  );
}
