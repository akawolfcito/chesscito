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
        <h2 className="mb-3 text-sm font-semibold text-cyan-200">
          {SUPPORT_COPY.sections.contactUs}
        </h2>
        <a
          href={SUPPORT_COPY.primaryChannel.href}
          className="flex min-h-[44px] items-center gap-3 rounded-xl bg-[var(--link-row-bg)] px-4 py-3 text-cyan-100 transition hover:bg-[var(--link-row-bg-hover)]"
        >
          <Mail size={18} className="shrink-0 text-cyan-400" />
          <div>
            <p className="text-sm font-medium">{SUPPORT_COPY.primaryChannel.label}</p>
            <p className="text-xs text-cyan-300/60">{SUPPORT_COPY.primaryChannel.value}</p>
          </div>
        </a>
      </section>

      {/* Secondary channel */}
      <section>
        <h2 className="mb-3 text-sm font-semibold text-cyan-200">
          {SUPPORT_COPY.sections.technicalIssues}
        </h2>
        <a
          href={SUPPORT_COPY.secondaryChannel.href}
          target="_blank"
          rel="noopener noreferrer"
          className="flex min-h-[44px] items-center gap-3 rounded-xl bg-[var(--link-row-bg)] px-4 py-3 text-cyan-100 transition hover:bg-[var(--link-row-bg-hover)]"
        >
          <Github size={18} className="shrink-0 text-cyan-400" />
          <div>
            <p className="text-sm font-medium">{SUPPORT_COPY.secondaryChannel.label}</p>
            <p className="text-xs text-cyan-300/60">{SUPPORT_COPY.secondaryChannel.value}</p>
          </div>
        </a>
      </section>

      {/* How to report */}
      <section>
        <h2 className="mb-3 text-sm font-semibold text-cyan-200">
          {SUPPORT_COPY.sections.howToReport}
        </h2>
        <p className="mb-3">{SUPPORT_COPY.howToReport}</p>
        <ul className="list-inside list-disc space-y-1 text-cyan-100/70">
          {SUPPORT_COPY.reportableIssues.map((issue) => (
            <li key={issue}>{issue}</li>
          ))}
        </ul>
      </section>

      {/* Response time */}
      <section>
        <p className="text-xs text-cyan-300/50">{SUPPORT_COPY.responseTime}</p>
      </section>
    </LegalPageShell>
  );
}
