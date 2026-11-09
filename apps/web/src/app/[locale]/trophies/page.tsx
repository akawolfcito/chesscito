"use client";

import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { CHESSCITO_LITE_MODE } from "@/lib/feature-flags";

import { ContextualHeader } from "@/components/ui/contextual-header";
import { TileIconSlot } from "@/components/ui/tile-icon-slot";
import { TrophiesBody, TrophiesHeroBand } from "@/components/trophies/trophies-body";
import { TrophiesDataProvider } from "@/components/trophies/trophies-data-provider";

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
  const t = useTranslations("TROPHY_VITRINE_COPY");
  return (
    <div className="trophies-candy-page mission-shell flex min-h-[100dvh] justify-center">
      <div className="flex w-full max-w-[var(--app-max-width,390px)] flex-col">
        <header className="border-b border-[rgba(110,65,15,0.30)]">
          <ContextualHeader
            variant="back-control"
            iconSlot={<TileIconSlot slot="shared.trophy-epic" />}
            title={t("pageTitle")}
            subtitle={t(CHESSCITO_LITE_MODE ? "pageDescriptionLite" : "pageDescription")}
            back={{ onClick: () => router.push("/"), label: t("backLabel") }}
          />
        </header>
        {/* 2026-05-30: hero band hoisted outside the scroll container.
         *  Mirrors the sheet pattern (commit 507bcb8b) — `overflow-y-auto`
         *  on the scroll div promotes overflow-x to auto and clips the
         *  trofeo-épico anchor's `left: -1.25rem` overhang. Hoisting
         *  keeps the character visibly escaping the panel and turns the
         *  band into a persistent overview header that doesn't scroll
         *  off with the detail sections. `TrophiesDataProvider` wraps
         *  both so the hero and the body share a single
         *  `/api/my-victories` fetch. */}
        <TrophiesDataProvider>
          <div className="shrink-0 mt-4 px-4">
            <TrophiesHeroBand />
          </div>
          <div className="flex-1 space-y-6 overflow-y-auto px-4 pb-8 pt-6">
            <TrophiesBody hideHero />
          </div>
        </TrophiesDataProvider>
      </div>
    </div>
  );
}
