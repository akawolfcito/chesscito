import Link from "next/link";

type LegalPageShellProps = {
  title: string;
  backHref?: string;
  children: React.ReactNode;
};

export function LegalPageShell({ title, backHref = "/about", children }: LegalPageShellProps) {
  return (
    <div className="mission-shell flex min-h-[100dvh] justify-center bg-black/50">
      <div className="flex w-full max-w-[var(--app-max-width)] flex-col rounded-t-3xl bg-[var(--surface-a)] backdrop-blur-2xl">
        <header className="flex items-center gap-3 border-b border-[var(--header-zone-border)] bg-[var(--header-zone-bg)] px-5 py-5 rounded-t-3xl">
          <Link
            href={backHref}
            className="flex h-11 w-11 items-center justify-center"
            aria-label="Go back"
          >
            <img
              src="/art/redesign/banners/btn-back.png"
              alt=""
              aria-hidden="true"
              className="h-8 w-8 object-contain"
            />
          </Link>
          <h1 className="text-xl font-bold text-slate-100">{title}</h1>
        </header>
        <div className="flex-1 space-y-6 px-5 pb-8 pt-6 text-sm leading-relaxed text-cyan-100/80">
          {children}
        </div>
      </div>
    </div>
  );
}
