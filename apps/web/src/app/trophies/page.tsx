"use client";

import Link from "next/link";

import { CandyIcon } from "@/components/redesign/candy-icon";
import { TrophiesBody } from "@/components/trophies/trophies-body";
import { ABOUT_LINK_COPY, TROPHY_VITRINE_COPY } from "@/lib/content/editorial";

/**
 * Standalone /trophies route. Mirrors the dock TrophiesSheet so the
 * hub Trophy chip can navigate here directly instead of round-
 * tripping through /hub?legacy=1&action=trophies (B-port from
 * docs/audits/2026-05-07-hub-audit.md).
 *
 * Shares <TrophiesBody> with the legacy sheet so any future change
 * to Hall of Fame / Achievements / My Victories renders both surfaces
 * identically.
 */
export default function TrophiesPage() {
  return (
    <main className="mx-auto flex min-h-[100dvh] max-w-[var(--app-max-width,390px)] flex-col px-4 py-6">
      <header className="mb-4 flex items-start gap-3 border-b border-[rgba(110,65,15,0.30)] pb-4">
        <Link
          href="/hub"
          aria-label="Back to hub"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[rgba(110,65,15,0.30)] text-lg font-bold transition-colors hover:bg-[rgba(110,65,15,0.08)]"
          style={{ color: "rgba(110, 65, 15, 0.85)" }}
        >
          ←
        </Link>
        <div className="flex-1">
          <h1
            className="fantasy-title flex items-center gap-2 text-lg"
            style={{
              color: "rgba(110, 65, 15, 0.95)",
              textShadow: "0 1px 0 rgba(255, 245, 215, 0.80)",
            }}
          >
            <CandyIcon name="trophy" className="h-5 w-5" />
            {TROPHY_VITRINE_COPY.pageTitle}
          </h1>
          <p className="mt-1 text-sm" style={{ color: "rgba(110, 65, 15, 0.70)" }}>
            {TROPHY_VITRINE_COPY.pageDescription}
          </p>
        </div>
      </header>
      <div className="flex-1 space-y-6 overflow-y-auto">
        <TrophiesBody />
      </div>
      <Link
        href="/about"
        className="mt-3 block text-center text-xs transition-colors hover:opacity-80"
        style={{ color: "rgba(110, 65, 15, 0.65)" }}
      >
        {ABOUT_LINK_COPY.label}
      </Link>
    </main>
  );
}
