"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

type LegalPageShellProps = {
  title: string;
  children: React.ReactNode;
};

export function LegalPageShell({ title, children }: LegalPageShellProps) {
  const router = useRouter();

  return (
    <div className="flex min-h-[100dvh] justify-center bg-[#0b1220]">
      <div className="flex w-full max-w-[var(--app-max-width)] flex-col px-5 py-4">
        <header className="mb-6 flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.push("/about")}
            className="flex h-11 w-11 items-center justify-center rounded-full text-cyan-200/70 transition hover:text-cyan-50"
            aria-label="Go back"
          >
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-lg font-semibold text-cyan-50">{title}</h1>
        </header>
        <div className="flex-1 space-y-6 pb-8 text-sm leading-relaxed text-cyan-100/80">
          {children}
        </div>
      </div>
    </div>
  );
}
