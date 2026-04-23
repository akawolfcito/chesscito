import Link from "next/link";
import { CandyBanner } from "@/components/redesign/candy-banner";

type LegalPageShellProps = {
  title: string;
  backHref?: string;
  children: React.ReactNode;
};

export function LegalPageShell({ title, backHref = "/about", children }: LegalPageShellProps) {
  return (
    <div className="mission-shell secondary-page-scrim flex min-h-[100dvh] justify-center">
      <div
        className="candy-page-panel flex w-full max-w-[var(--app-max-width)] flex-col rounded-t-3xl"
        style={{ background: "var(--paper-bg)" }}
      >
        <header
          className="flex items-center gap-3 border-b px-5 py-5 rounded-t-3xl"
          style={{ borderColor: "var(--paper-divider)" }}
        >
          <Link
            href={backHref}
            className="flex h-11 w-11 items-center justify-center"
            aria-label="Go back"
          >
            <CandyBanner name="btn-back" className="h-8 w-8" />
          </Link>
          <h1 className="fantasy-title text-xl font-bold" style={{ color: "var(--paper-text)" }}>
            {title}
          </h1>
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
