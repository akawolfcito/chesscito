"use client";

import { useRouter } from "next/navigation";

import { ContextualHeader } from "@/components/ui/contextual-header";
import { TileIconSlot } from "@/components/ui/tile-icon-slot";
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
  const router = useRouter();
  return (
    <main className="trophies-candy-page mission-shell flex min-h-[100dvh] justify-center">
      <div className="flex w-full max-w-[var(--app-max-width,390px)] flex-col">
        <header className="border-b border-[rgba(110,65,15,0.30)]">
          <ContextualHeader
            variant="back-control"
            iconSlot={<TileIconSlot src="/art/action-row/trofeo-epico" />}
            title={TROPHY_VITRINE_COPY.pageTitle}
            subtitle={TROPHY_VITRINE_COPY.pageDescription}
            back={{ onClick: () => router.push("/hub"), label: "Back" }}
          />
        </header>
        <div className="flex-1 space-y-6 overflow-y-auto px-4 pb-8 pt-4">
          <TrophiesBody />
        </div>
      </div>
    </main>
  );
}
