"use client";

import { useCallback, useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { useAccount } from "wagmi";
import { useLocale, useTranslations } from "next-intl";

import { AskLuzBanner } from "@/components/coach/ask-luz-banner";
import { CoachHistory } from "@/components/coach/coach-history";
import { CoachHistoryDeletePanel } from "@/components/coach/coach-history-delete-panel";
import { CoachPanel } from "@/components/coach/coach-panel";
import { ContextualHeader } from "@/components/ui/contextual-header";
import { TileIconSlot } from "@/components/ui/tile-icon-slot";
import { CandyGlassShell } from "@/components/redesign/candy-glass-shell";
import { requestCoachAnalyze } from "@/lib/coach/request-coach-analyze";
import type { CoachAnalysisRecord, CoachResponse, GameRecord } from "@/lib/coach/types";
import { useCoachCredits } from "@/lib/coach/use-coach-credits";
import { useIsProActive } from "@/lib/pro/use-is-pro-active";

type HistoryEntry = CoachAnalysisRecord & { game: GameRecord };

type SelectedFullEntry = {
  response: Extract<CoachResponse, { kind: "full" }>;
  game: GameRecord;
  gameId: string;
  locale?: "en" | "es";
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
        back={{ onClick: onBack, label: t("backLabel") }}
      />
    </header>
  );
}

export default function CoachHistoryPage() {
  const t = useTranslations("COACH_COPY");
  const { address } = useAccount();
  const router = useRouter();
  const activeLocale = useLocale() as "en" | "es";
  const [selected, setSelected] = useState<SelectedFullEntry | null>(null);
  const [isReanalyzing, setIsReanalyzing] = useState(false);
  const { credits } = useCoachCredits();
  const isPro = useIsProActive();
  const showAskLuzBanner = !!address && !isPro && credits === 0;

  /**
   * Reanalyze handler — mirrors the arena page wire-up. Bypasses the
   * locale-keyed idempotency cache via `forceLocale: true` so the LLM
   * regenerates in the user's active locale. On success, swaps the
   * panel's response + locale in place; the URL / wrapper stay put.
   */
  const handleReanalyze = useCallback(async () => {
    if (!address || !selected) return;
    setIsReanalyzing(true);
    try {
      const outcome = await requestCoachAnalyze(
        selected.gameId,
        address,
        fetch,
        activeLocale,
        { forceLocale: true },
      );
      if (outcome.kind === "ready" && outcome.response.kind === "full") {
        setSelected({
          ...selected,
          response: outcome.response,
          locale: outcome.locale ?? activeLocale,
        });
      }
      // Other outcomes (queued/paywall/error) currently leave the panel
      // as-is. The history page doesn't host a loading/paywall surface
      // — surfacing those would need a parity rework with /arena.
    } finally {
      setIsReanalyzing(false);
    }
  }, [address, selected, activeLocale]);

  if (!address) {
    return (
      <main className="tj-root">
        <PageHeader onBack={() => router.push("/hub")} />
        <p className="tj-no-wallet-text">{t("connectWalletForHistory")}</p>
      </main>
    );
  }

  function handleSelect(entry: HistoryEntry) {
    if (entry.response.kind !== "full") return;
    setSelected({
      response: entry.response,
      game: entry.game,
      gameId: entry.gameId,
      locale: entry.locale,
    });
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
              analysisLocale={selected.locale}
              onReanalyze={handleReanalyze}
              isReanalyzing={isReanalyzing}
              moves={selected.game.moves}
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
        {showAskLuzBanner && (
          <AskLuzBanner onPress={() => router.push("/arena?fresh=1")} />
        )}
        <CoachHistory
          walletAddress={address}
          credits={credits}
          onSelectEntry={handleSelect}
        />
        <CoachHistoryDeletePanel />
      </div>
    </main>
  );
}
