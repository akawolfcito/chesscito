"use client";

import { useRouter } from "@/i18n/navigation";
import { useAccount } from "wagmi";
import { useTranslations } from "next-intl";

import { AskLuzBanner } from "@/components/coach/ask-luz-banner";
import { CoachHistory } from "@/components/coach/coach-history";
import { CoachHistoryDeletePanel } from "@/components/coach/coach-history-delete-panel";
import { ContextualHeader } from "@/components/ui/contextual-header";
import { TileIconSlot } from "@/components/ui/tile-icon-slot";
import { PrincipalButton } from "@/components/scene-rooted/principal-button";
import type { CoachAnalysisRecord, GameRecord } from "@/lib/coach/types";
import { useCoachCredits } from "@/lib/coach/use-coach-credits";
import { useIsProActive } from "@/lib/pro/use-is-pro-active";
import { useConnectWallet } from "@/lib/wallet/use-connect-wallet";

type HistoryEntry = CoachAnalysisRecord & { game: GameRecord };

/**
 * Coach session history page — Training Journal.
 *
 * Visual refactor 2026-05-13: upgraded to game-native header + layout
 * so the Training Journal feels like a premium training log inside the
 * game, not a generic account/history page.
 *
 * T11 refactor: tapping an entry now routes to the canonical
 * /coach/[gameId] viewer instead of mounting <CoachPanel> inline.
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
  const { connectWallet } = useConnectWallet();
  const router = useRouter();
  const { credits } = useCoachCredits();
  const isPro = useIsProActive();
  const showAskLuzBanner = !!address && !isPro && credits === 0;

  if (!address) {
    return (
      // The PLAY dock used to hand this player the ProSheet, whose primary CTA
      // is literally "Connect wallet". Now that the Coach opens the Journal
      // instead, this branch IS the connect funnel — the copy states the gate,
      // and the button has to open it. Without the button we'd have traded a
      // paywall for a dead end (red team P0, 2026-07-13).
      <main className="tj-root">
        <PageHeader onBack={() => router.push("/")} />
        <p className="tj-no-wallet-text">{t("connectWalletForHistory")}</p>
        <PrincipalButton
          size="medium"
          className="self-center"
          onClick={() => connectWallet()}
        >
          {t("connectWalletButton")}
        </PrincipalButton>
      </main>
    );
  }

  function handleSelect(entry: HistoryEntry) {
    // Save Later (2026-05-31): win+!minted rows append `?focus=save` so
    // the visor scrolls + highlights the Save Victory tile on mount.
    // Gives users a second chance to mint a past win they cancelled in
    // the moment. See `project_satori_og_perf_constraints` neighbor
    // memory + this cluster's handoff for the full rationale.
    const shouldFocusSave =
      entry.game.result === "win" && !entry.game.mintedTokenId;
    const url = shouldFocusSave
      ? `/coach/${entry.gameId}?wallet=${address}&focus=save`
      : `/coach/${entry.gameId}?wallet=${address}`;
    router.push(url);
  }

  // 2026-05-29 (Cluster C follow-up): unanalyzed rows route to the
  // canonical /coach/[gameId] viewer too, where the credit-aware
  // Ask Coach CTA lives. The previous gap left the chip wired to a
  // no-op in this surface (only /arena passed `onAnalyzeUnanalyzed`),
  // so taps did nothing — see docs/handoffs/2026-05-29-coach-viewer-cluster-c-handoff.md.
  function handleAnalyzeUnanalyzed(gameId: string) {
    router.push(`/coach/${gameId}?wallet=${address}`);
  }

  return (
    <main className="tj-root">
      <PageHeader onBack={() => router.push("/")} />
      <div className="tj-content">
        {/* Review F6 (2026-06-13): a PLAY shortcut so the Journal is a fluid
            jumping-off point — especially after a 0-move game now lands here
            instead of an empty board. */}
        <PrincipalButton
          onClick={() => router.push("/arena?fresh=1")}
          className="self-center"
          aria-label={t("playCta")}
        >
          {t("playCta")}
        </PrincipalButton>
        {showAskLuzBanner && (
          <AskLuzBanner onPress={() => router.push("/arena?fresh=1")} />
        )}
        <CoachHistory
          walletAddress={address}
          credits={credits}
          onSelectEntry={handleSelect}
          onAnalyzeUnanalyzed={handleAnalyzeUnanalyzed}
        />
        <CoachHistoryDeletePanel />
      </div>
    </main>
  );
}
