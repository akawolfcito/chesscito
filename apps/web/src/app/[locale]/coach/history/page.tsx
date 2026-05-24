"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAccount } from "wagmi";
import { useTranslations } from "next-intl";

import { CoachHistory } from "@/components/coach/coach-history";
import { CoachHistoryDeletePanel } from "@/components/coach/coach-history-delete-panel";
import { CoachPanel } from "@/components/coach/coach-panel";
import { ContextualHeader } from "@/components/ui/contextual-header";
import { TileIconSlot } from "@/components/ui/tile-icon-slot";
import { CandyGlassShell } from "@/components/redesign/candy-glass-shell";
import type { CoachAnalysisRecord, CoachResponse, GameRecord } from "@/lib/coach/types";

type HistoryEntry = CoachAnalysisRecord & { game: GameRecord };

type SelectedFullEntry = {
  response: Extract<CoachResponse, { kind: "full" }>;
  game: GameRecord;
};

/**
 * Coach session history page — Training Journal.
 *
 * Visual refactor 2026-05-13: upgraded to game-native header + layout
 * so the Training Journal feels like a premium training log inside the
 * game, not a generic account/history page. Business logic, routing,
 * delete behavior, and API calls are completely unchanged.
 *
 * Spec §9.2.
 */
function PageHeader({ onBack }: { onBack: () => void }) {
  // Stripped the legacy `.tj-page-header` className — its yellow-cream
  // gradient + custom 1.5px golden divider + drop shadow no longer match
  // the rest of the app (Sally pass 9, 2026-05-20). The canonical
  // ContextualHeader envelope renders on the page's natural background;
  // the `border-b` here is the canonical 0.30 divider matching every
  // other meta page (legal, /trophies, etc.).
  const t = useTranslations("COACH_COPY");
  return (
    <header className="border-b border-[rgba(110,65,15,0.30)]">
      <ContextualHeader
        variant="back-control"
        iconSlot={<TileIconSlot src="/art/new-icons-chesscito/training" />}
        title={t("yourSessions")}
        subtitle={t("historyBannerSubtitle")}
        back={{ onClick: onBack, label: "Back" }}
      />
    </header>
  );
}

export default function CoachHistoryPage() {
  const t = useTranslations("COACH_COPY");
  const { address } = useAccount();
  const router = useRouter();
  const [selected, setSelected] = useState<SelectedFullEntry | null>(null);

  if (!address) {
    return (
      <main className="tj-root">
        <PageHeader onBack={() => router.push("/hub")} />
        <p className="tj-no-wallet-text">
          Connect your wallet to view your Coach history.
        </p>
      </main>
    );
  }

  function handleSelect(entry: HistoryEntry) {
    if (entry.response.kind !== "full") return;
    setSelected({ response: entry.response, game: entry.game });
  }

  if (selected) {
    return (
      <main className="arena-bg arena-scroll-screen h-[100dvh] [-webkit-overflow-scrolling:touch]">
        <div className="mx-auto min-h-full w-full max-w-[var(--app-max-width,390px)]">
          <CandyGlassShell
            title={t("coachAnalysisTitle")}
            onClose={() => setSelected(null)}
            closeLabel={t("yourSessions")}
            presentation="screen"
            className="pb-[calc(env(safe-area-inset-bottom,0px)+1rem)] pt-[calc(env(safe-area-inset-top,0px)+1rem)]"
          >
            <CoachPanel
              response={selected.response}
              difficulty={selected.game.difficulty}
              totalMoves={selected.game.totalMoves}
              elapsedMs={selected.game.elapsedMs}
              credits={0}
              onPlayAgain={() => router.push("/arena?fresh=1")}
              onBackToHub={() => setSelected(null)}
            />
          </CandyGlassShell>
        </div>
      </main>
    );
  }

  return (
    <main className="tj-root">
      <PageHeader onBack={() => router.push("/hub")} />
      <div className="tj-content">
        <CoachHistory
          walletAddress={address}
          credits={0}
          onSelectEntry={handleSelect}
        />
        <CoachHistoryDeletePanel />
      </div>
    </main>
  );
}
