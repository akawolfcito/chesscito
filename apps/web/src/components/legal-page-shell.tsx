"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ContextualHeader } from "@/components/ui/contextual-header";

type LegalPageShellProps = {
  title: string;
  /** Optional one-line description under the title. Used by /trophies
   *  and other pages that want a subtitle; legal pages omit it. */
  subtitle?: string;
  backHref?: string;
  children: React.ReactNode;
};

export function LegalPageShell({
  title,
  subtitle,
  backHref = "/about",
  children,
}: LegalPageShellProps) {
  const router = useRouter();
  const t = useTranslations("LEGAL_SHELL_COPY");

  return (
    <div className="mission-shell secondary-page-scrim flex min-h-[100dvh] justify-center">
      <div
        className="candy-page-panel flex w-full max-w-[var(--app-max-width)] flex-col rounded-t-3xl"
        style={{ background: "var(--paper-bg)" }}
      >
        <header
          className="rounded-t-3xl border-b"
          style={{ borderColor: "var(--paper-divider)" }}
        >
          <ContextualHeader
            variant="back-control"
            title={title}
            subtitle={subtitle}
            back={{ onClick: () => router.push(backHref), label: t("back") }}
          />
        </header>
        <div
          className="flex-1 space-y-6 px-5 pb-8 pt-6 text-sm leading-relaxed"
          style={{ color: "var(--paper-text)" }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
