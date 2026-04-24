"use client";

import { TrophyPageShell } from "@/components/trophies/trophy-page-shell";
import { TrophiesBody } from "@/components/trophies/trophies-body";
import { TROPHY_VITRINE_COPY } from "@/lib/content/editorial";

export default function TrophiesPage() {
  return (
    <TrophyPageShell
      title={TROPHY_VITRINE_COPY.pageTitle}
      subtitle={TROPHY_VITRINE_COPY.pageDescription}
      backHref="/"
    >
      <TrophiesBody />
    </TrophyPageShell>
  );
}
