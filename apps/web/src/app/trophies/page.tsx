"use client";

import Link from "next/link";

import { CandyBanner } from "@/components/redesign/candy-banner";
import { CandyIcon } from "@/components/redesign/candy-icon";
import { TrophiesBody } from "@/components/trophies/trophies-body";
import { TROPHY_VITRINE_COPY } from "@/lib/content/editorial";

/**
 * Standalone /trophies route. Mirrors the in-hub TrophiesSheet so the
 * page and the dock sheet share the same body + visual treatment
 * (SPEC 1 D8 — two surfaces, one body, both candy-aligned).
 *
 * Visual: `.trophies-candy-page` opts into the shared sheet-bg-hub
 * tree band + cream wash so the page no longer reads as off-line
 * graphically. Inner content stays transparent on top of the
 * decorative band; `<TrophiesBody>` renders its own cards.
 */
export default function TrophiesPage() {
  return (
    <main className="trophies-candy-page mission-shell flex min-h-[100dvh] justify-center">
      <div className="flex w-full max-w-[var(--app-max-width,390px)] flex-col px-4 py-6">
        <header className="mb-4 flex items-start gap-3 border-b border-[rgba(110,65,15,0.30)] pb-4">
          <Link
            href="/hub"
            aria-label="Back to hub"
            className="candy-nav-button"
          >
            <CandyBanner name="btn-back" className="h-9 w-9" />
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
      </div>
    </main>
  );
}
