"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import type { GameRecord } from "@/lib/coach/types";
import { GameViewer } from "@/components/coach/game-viewer";
import { GameActionsBar } from "@/components/coach/game-actions-bar";
import { ConnectPromptToast } from "@/components/connect-prompt/connect-prompt-toast";
import { CoachPanel } from "@/components/coach/coach-panel";
import { CoachFallback } from "@/components/coach/coach-fallback";
import { useCoachAnalysis } from "@/lib/coach/use-coach-analysis";
import { useMintVictory } from "@/lib/coach/use-mint-victory";
import { useGameReplay } from "@/lib/game/use-game-replay";
import { track } from "@/lib/telemetry";
import { postMintReceipt } from "@/lib/coach/post-mint-receipt";

type Props = {
  gameRecord: GameRecord | null;
  walletAddress?: `0x${string}`;
};

function mapResult(r: GameRecord["result"] | undefined): "win" | "lose" | "draw" | "resigned" {
  if (r === "win") return "win";
  if (r === "draw") return "draw";
  if (r === "resigned") return "resigned";
  return "lose";
}

export function CoachGameClient({ gameRecord, walletAddress }: Props) {
  const t = useTranslations("COACH_VIEWER_COPY");
  const router = useRouter();
  // ConnectPromptToast requires onDismiss — track dismissed state locally
  const [connectPromptDismissed, setConnectPromptDismissed] = useState(false);

  const handleBack = useCallback(() => {
    track("coach_viewer_back_tap", {
      gameId: gameRecord?.gameId ?? "unknown",
      history_depth: typeof window !== "undefined" ? window.history.length : 0,
    });
    if (typeof window !== "undefined" && window.history.length > 1) router.back();
    else router.push("/hub");
  }, [router, gameRecord?.gameId]);

  const handlePlayAgain = useCallback(() => {
    track("coach_viewer_play_again_tap", { gameId: gameRecord?.gameId ?? "unknown" });
    router.push("/arena?fresh=1");
  }, [router, gameRecord?.gameId]);

  // Hook calls MUST run unconditionally per Rules of Hooks
  const safeMoves = gameRecord?.moves ?? [];
  const replay = useGameReplay(safeMoves, gameRecord?.startingFen);

  const coach = useCoachAnalysis({
    gameId: gameRecord?.gameId,
    walletAddress,
    result: mapResult(gameRecord?.result),
    difficulty: gameRecord?.difficulty,
    moves: safeMoves,
    elapsedMs: gameRecord?.elapsedMs,
    surface: "coach_viewer",
  });

  const mint = useMintVictory({
    gameId: gameRecord?.gameId,
    walletAddress,
    difficulty: gameRecord?.difficulty,
    result: "win",
    totalMoves: gameRecord?.totalMoves ?? 0,
    elapsedMs: gameRecord?.elapsedMs ?? 0,
  });

  // Persist mint outcome to gameRecord for cold-load viewers (fire-and-forget).
  // mint.data.tokenId is bigint | null — convert to string before posting.
  useEffect(() => {
    if (mint.phase !== "success") return;
    if (!mint.data.tokenId || !mint.data.claimTxHash || !mint.data.shareCardUrl || !mint.data.shareLinkUrl) return;
    if (!gameRecord || !walletAddress) return;
    void postMintReceipt({
      gameId: gameRecord.gameId,
      walletAddress,
      tokenId: String(mint.data.tokenId),
      claimTxHash: mint.data.claimTxHash,
      shareCardUrl: mint.data.shareCardUrl,
      shareLinkUrl: mint.data.shareLinkUrl,
      surface: "coach_viewer",
    });
  }, [mint.phase, mint.data, gameRecord, walletAddress]);

  const handleAskCoach = useCallback(() => {
    if (!gameRecord) return;
    track("coach_viewer_ask_coach_tap", {
      gameId: gameRecord.gameId,
      has_existing_analysis: !!gameRecord.analysis,
    });
    coach.askCoach("viewer");
  }, [coach, gameRecord]);

  const handleMint = useCallback(() => {
    if (!gameRecord) return;
    track("coach_viewer_mint_tap", { gameId: gameRecord.gameId, difficulty: gameRecord.difficulty });
    void mint.start();
  }, [mint, gameRecord]);

  const handleShare = useCallback(() => {
    if (!gameRecord) return;
    const tokenId =
      mint.data.tokenId != null ? String(mint.data.tokenId) : (gameRecord.mintedTokenId ?? null);
    const shareLink = mint.data.shareLinkUrl ?? gameRecord.shareLinkUrl ?? null;
    track("coach_viewer_share_tap", {
      gameId: gameRecord.gameId,
      tokenId: tokenId ?? undefined,
    });
    if (shareLink && typeof navigator !== "undefined" && "share" in navigator) {
      const nav = navigator as Navigator & { share?: (data: ShareData) => Promise<void> };
      void nav.share?.({ url: shareLink });
    }
  }, [gameRecord, mint.data.tokenId, mint.data.shareLinkUrl]);

  const handleViewNft = useCallback(() => {
    if (!gameRecord) return;
    const tx = mint.data.claimTxHash ?? gameRecord.claimTxHash;
    if (tx && typeof window !== "undefined") {
      window.open(`https://celoscan.io/tx/${tx}`, "_blank", "noopener");
    }
  }, [mint.data.claimTxHash, gameRecord]);

  // Branch 1: no wallet
  if (!walletAddress) {
    return (
      <div className="coach-game-client coach-game-client--no-wallet">
        {!connectPromptDismissed && (
          <ConnectPromptToast
            // ConnectPromptMilestone only accepts "stars" | "victory" | "badges"
            // "victory" is the closest semantic match for this reconnect surface
            milestone="victory"
            onConnect={() => router.refresh()}
            onDismiss={() => setConnectPromptDismissed(true)}
          />
        )}
      </div>
    );
  }

  // Branch 2: no record (404 / network error fallback from server page)
  if (!gameRecord) {
    return (
      <div className="coach-game-client coach-game-client--error">
        <p className="coach-game-client__error-message">{t("loadErrorTitle")}</p>
        <p className="coach-game-client__error-subtitle">{t("loadErrorSubtitle")}</p>
        <button
          type="button"
          onClick={() => router.push("/arena?fresh=1")}
          className="coach-game-client__cta"
        >
          {t("playAgain")}
        </button>
      </div>
    );
  }

  const mappedResult = mapResult(gameRecord.result);
  // mint.data.tokenId is bigint | null — convert to string for display
  const tokenIdEffective =
    mint.data.tokenId != null
      ? String(mint.data.tokenId)
      : (gameRecord.mintedTokenId ?? null);
  const shareLinkEffective = mint.data.shareLinkUrl ?? gameRecord.shareLinkUrl ?? null;

  // Inline analysis surface (when record has cached analysis)
  let inlineAnalysisNode: React.ReactNode = null;
  if (gameRecord.analysis) {
    if (gameRecord.analysis.response.kind === "full") {
      inlineAnalysisNode = (
        <CoachPanel
          response={gameRecord.analysis.response}
          difficulty={gameRecord.difficulty}
          totalMoves={gameRecord.totalMoves}
          elapsedMs={gameRecord.elapsedMs}
          credits={0}
          onPlayAgain={handlePlayAgain}
          onBackToHub={handleBack}
          analysisLocale={gameRecord.analysis.locale}
          moves={gameRecord.moves}
        />
      );
    } else {
      // quick kind — CoachFallback also requires `result` prop
      inlineAnalysisNode = (
        <CoachFallback
          response={gameRecord.analysis.response}
          difficulty={gameRecord.difficulty}
          totalMoves={gameRecord.totalMoves}
          elapsedMs={gameRecord.elapsedMs}
          result={mappedResult}
          onGetFullAnalysis={handleAskCoach}
          onPlayAgain={handlePlayAgain}
          onBackToHub={handleBack}
        />
      );
    }
  }

  return (
    <div className="coach-game-client">
      <GameViewer moves={gameRecord.moves} startingFen={gameRecord.startingFen} />

      <GameActionsBar
        gameId={gameRecord.gameId}
        result={mappedResult}
        totalMoves={gameRecord.totalMoves}
        hasAnalysis={!!gameRecord.analysis}
        hasPartialReplayError={!!replay.error}
        mintedTokenId={tokenIdEffective}
        shareLinkUrl={shareLinkEffective}
        onAskCoach={handleAskCoach}
        onMint={handleMint}
        onShare={handleShare}
        onPlayAgain={handlePlayAgain}
        onViewNft={handleViewNft}
      />

      {inlineAnalysisNode}
    </div>
  );
}
