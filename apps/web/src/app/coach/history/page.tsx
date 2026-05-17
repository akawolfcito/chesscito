"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAccount } from "wagmi";
import { CoachHistory } from "@/components/coach/coach-history";
import { CoachHistoryDeletePanel } from "@/components/coach/coach-history-delete-panel";
import { CoachPanel } from "@/components/coach/coach-panel";
import { CandyBanner } from "@/components/redesign/candy-banner";
import { CandyIcon } from "@/components/redesign/candy-icon";
import { CandyGlassShell } from "@/components/redesign/candy-glass-shell";
import { COACH_COPY } from "@/lib/content/editorial";
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
function PageHeader() {
  return (
    <header className="tj-page-header">
      <Link
        href="/hub"
        aria-label="Back to hub"
        className="tj-page-header-back candy-nav-button"
      >
        <CandyBanner name="btn-back" className="h-9 w-9" />
      </Link>
      <div className="tj-page-header-title-group">
        <div className="flex items-center gap-2">
          <CandyIcon name="coach" className="h-5 w-5 shrink-0" />
          <h1 className="tj-page-header-title">{COACH_COPY.yourSessions}</h1>
        </div>
        <p className="tj-page-header-subtitle">Your training progress</p>
      </div>
    </header>
  );
}

export default function CoachHistoryPage() {
  const { address } = useAccount();
  const router = useRouter();
  const [selected, setSelected] = useState<SelectedFullEntry | null>(null);

  if (!address) {
    return (
      <main className="tj-root">
        <PageHeader />
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
            title={COACH_COPY.coachAnalysisTitle}
            onClose={() => setSelected(null)}
            closeLabel={COACH_COPY.yourSessions}
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
      <PageHeader />
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
