"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

type LegalPageShellProps = {
  title: string;
  backHref?: string;
  children: React.ReactNode;
};

export function LegalPageShell({ title, backHref = "/about", children }: LegalPageShellProps) {
  const router = useRouter();

  return (
    <div className="mission-shell flex min-h-[100dvh] justify-center bg-black/50">
      <div className="flex w-full max-w-[var(--app-max-width)] flex-col rounded-t-3xl bg-[var(--surface-a)] backdrop-blur-2xl">
        <header className="flex items-center gap-3 border-b border-[var(--header-zone-border)] bg-[var(--header-zone-bg)] px-5 py-5 rounded-t-3xl">
          <button
            type="button"
            onClick={() => {
              if (window.history.length > 1) {
                router.back();
              } else {
                router.push(backHref);
              }
            }}
            className="flex h-11 w-11 items-center justify-center rounded-full border border-white/[0.12] bg-white/[0.10] text-cyan-200/80 transition hover:text-cyan-50"
            aria-label="Go back"
          >
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-lg font-semibold text-slate-100">{title}</h1>
        </header>
        <div className="flex-1 space-y-6 px-5 pb-8 pt-6 text-sm leading-relaxed text-cyan-100/80">
          {children}
        </div>
      </div>
    </div>
  );
}
