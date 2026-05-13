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
 * Coach session history page. Mounts the existing <CoachHistory> list
 * plus the new <CoachHistoryDeletePanel>. Page exists so the
 * "manage history" link in the <CoachPanel> footer (Task 7) has a target
 * (red-team P0-2 — verified the route did not exist before PR 4).
 *
 * Spec §9.2.
 *
 * 2026-05-07: added back-to-hub affordance (user got trapped on the
 * page with no escape) and a clickable entry handler stub —
 * <CoachHistory>'s onSelectEntry signature already supports navigation,
 * so we render the selected analysis through the existing full-screen
 * CoachPanel flow.
 */
function PageHeader() {
  return (
    <header className="mb-4 flex items-start gap-3 border-b border-[rgba(110,65,15,0.30)] pb-4">
      <Link
        href="/hub"
        aria-label="Back to hub"
        className="flex h-11 w-11 shrink-0 items-center justify-center transition-transform active:scale-[0.94]"
      >
        <CandyBanner name="btn-back" className="h-9 w-9" />
      </Link>
      <h1
        className="fantasy-title flex items-center gap-2 text-lg"
        style={{
          color: "rgba(110, 65, 15, 0.95)",
          textShadow: "0 1px 0 rgba(255, 245, 215, 0.80)",
        }}
      >
        <CandyIcon name="coach" className="h-5 w-5" />
        {COACH_COPY.yourSessions}
      </h1>
    </header>
  );
}

export default function CoachHistoryPage() {
  const { address } = useAccount();
  const router = useRouter();
  const [selected, setSelected] = useState<SelectedFullEntry | null>(null);

  if (!address) {
    return (
      <main className="mx-auto flex min-h-[100dvh] max-w-[var(--app-max-width,390px)] flex-col px-4 py-6">
        <PageHeader />
        <p className="text-sm" style={{ color: "rgba(110, 65, 15, 0.75)" }}>
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
    <main className="mx-auto flex min-h-[100dvh] max-w-[var(--app-max-width,390px)] flex-col px-4 py-6">
      <PageHeader />
      <CoachHistory
        walletAddress={address}
        credits={0}
        onSelectEntry={handleSelect}
      />
      <CoachHistoryDeletePanel />
    </main>
  );
}
