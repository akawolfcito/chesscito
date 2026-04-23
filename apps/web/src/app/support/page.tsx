import { LegalPageShell } from "@/components/legal-page-shell";
import { SUPPORT_COPY } from "@/lib/content/editorial";
import { Mail, Github } from "lucide-react";

export const metadata = {
  title: "Support — Chesscito",
  description: "Get help with Chesscito — report issues, ask questions, or request features.",
};

export default function SupportPage() {
  return (
    <LegalPageShell title={SUPPORT_COPY.title}>
      {/* Primary channel */}
      <section>
        <h2 className="mb-3 text-sm font-bold" style={{ color: "var(--paper-text)" }}>
          {SUPPORT_COPY.sections.contactUs}
        </h2>
        {SUPPORT_COPY.primaryChannel.href ? (
          <a
            href={SUPPORT_COPY.primaryChannel.href}
            className="paper-tray flex min-h-[44px] items-center gap-3 transition active:scale-[0.99]"
            style={{ color: "var(--paper-text)" }}
          >
            <Mail size={18} className="shrink-0" style={{ color: "rgba(180, 110, 20, 0.95)" }} />
            <div>
              <p className="text-sm font-semibold">{SUPPORT_COPY.primaryChannel.label}</p>
              <p className="text-xs" style={{ color: "var(--paper-text-muted)" }}>
                {SUPPORT_COPY.primaryChannel.value}
              </p>
            </div>
          </a>
        ) : (
          <div
            className="paper-tray flex min-h-[44px] items-center gap-3 opacity-60"
            style={{ color: "var(--paper-text-muted)" }}
          >
            <Mail size={18} className="shrink-0 opacity-60" />
            <p className="text-sm font-semibold">{SUPPORT_COPY.primaryChannel.unavailable}</p>
          </div>
        )}
      </section>

      {/* Secondary channel */}
      <section>
        <h2 className="mb-3 text-sm font-bold" style={{ color: "var(--paper-text)" }}>
          {SUPPORT_COPY.sections.technicalIssues}
        </h2>
        <a
          href={SUPPORT_COPY.secondaryChannel.href}
          target="_blank"
          rel="noopener noreferrer"
          className="paper-tray flex min-h-[44px] items-center gap-3 transition active:scale-[0.99]"
          style={{ color: "var(--paper-text)" }}
        >
          <Github size={18} className="shrink-0" style={{ color: "rgba(180, 110, 20, 0.95)" }} />
          <div>
            <p className="text-sm font-semibold">{SUPPORT_COPY.secondaryChannel.label}</p>
            <p className="text-xs" style={{ color: "var(--paper-text-muted)" }}>
              {SUPPORT_COPY.secondaryChannel.value}
            </p>
          </div>
        </a>
      </section>

      {/* How to report */}
      <section>
        <h2 className="mb-3 text-sm font-bold" style={{ color: "var(--paper-text)" }}>
          {SUPPORT_COPY.sections.howToReport}
        </h2>
        <p className="mb-3" style={{ color: "var(--paper-text-muted)" }}>{SUPPORT_COPY.howToReport}</p>
        <ul className="list-inside list-disc space-y-1" style={{ color: "var(--paper-text-muted)" }}>
          {SUPPORT_COPY.reportableIssues.map((issue) => (
            <li key={issue}>{issue}</li>
          ))}
        </ul>
      </section>

      {/* Response time */}
      <section>
        <p className="text-xs" style={{ color: "var(--paper-text-subtle)" }}>{SUPPORT_COPY.responseTime}</p>
      </section>
    </LegalPageShell>
  );
}
