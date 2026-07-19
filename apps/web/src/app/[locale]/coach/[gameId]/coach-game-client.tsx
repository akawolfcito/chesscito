"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import type { GameRecord } from "@/lib/coach/types";
import { GameViewer } from "@/components/coach/game-viewer";
import { GameActionsBar } from "@/components/coach/game-actions-bar";
import { MintSuccessToast } from "@/components/coach/mint-success-toast";
import { ConnectPromptToast } from "@/components/connect-prompt/connect-prompt-toast";
import { CoachPanel } from "@/components/coach/coach-panel";
import { CoachFallback } from "@/components/coach/coach-fallback";
import { useCoachAnalysis } from "@/lib/coach/use-coach-analysis";
import { useMintVictory } from "@/lib/coach/use-mint-victory";
import { useGameReplay } from "@/lib/game/use-game-replay";
import { track } from "@/lib/telemetry";
import { postMintReceipt } from "@/lib/coach/post-mint-receipt";
import { formatTime } from "@/lib/game/arena-utils";
import { ARENA_COPY, SHARE_COPY } from "@/lib/content/editorial";
import { BoardThumbnail } from "@/components/board/board-thumbnail";
import { formatVictoryPriceForDifficulty } from "@/lib/coach/format-price";
import { ContextualHeader } from "@/components/ui/contextual-header";
import { TileIconSlot } from "@/components/ui/tile-icon-slot";
import { useIsProActive } from "@/lib/pro/use-is-pro-active";
import { ThemeAssetPicture } from "@/components/themes/theme-asset-picture";

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
  const searchParams = useSearchParams();
  const focusSave = searchParams?.get("focus") === "save";
  // ConnectPromptToast requires onDismiss — track dismissed state locally
  const [connectPromptDismissed, setConnectPromptDismissed] = useState(false);
  const proActive = useIsProActive();

  const handleBack = useCallback(() => {
    track("coach_viewer_back_tap", {
      gameId: gameRecord?.gameId ?? "unknown",
      history_depth: typeof window !== "undefined" ? window.history.length : 0,
      has_record: !!gameRecord,
    });
    // Bug 3 — when the viewer is in its no-record fallback (404 / load
    // error) the previous history entry is the arena flow that already
    // failed; router.back() would just bounce the user into the same
    // broken state. Force a clean push to root so the dead-end is
    // recoverable.
    if (!gameRecord) {
      router.push("/");
      return;
    }
    if (typeof window !== "undefined" && window.history.length > 1) router.back();
    else router.push("/");
  }, [router, gameRecord]);

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

  // Prefer the persisted playerColor (arena POST writes it as of 2026-05-30).
  // Legacy records written before that change omit the field, so we fall back
  // to move-list parity: every odd-indexed move is white's, even-indexed is
  // black's — so if `moves.length` is odd, white played the last (mating)
  // move; if even, black did. Parity is reliable while `result === "win"`
  // means checkmate; the persisted field removes the implicit assumption for
  // every new record.
  const safePlayerColor: "w" | "b" =
    gameRecord?.playerColor ??
    (gameRecord && gameRecord.moves.length > 0 && gameRecord.moves.length % 2 === 0
      ? "b"
      : "w");

  const mint = useMintVictory({
    gameId: gameRecord?.gameId,
    walletAddress,
    difficulty: gameRecord?.difficulty,
    // F8: save the ACTUAL outcome, not a hardcoded win.
    result: mapResult(gameRecord?.result),
    totalMoves: gameRecord?.totalMoves ?? 0,
    elapsedMs: gameRecord?.elapsedMs ?? 0,
    // 2026-05-30 (Bug from MiniPay smoke): without moveHistory the
    // route returns 400 immediately (`moveHistory must contain at
    // least one move`). The visor knows the moves from gameRecord —
    // pass them through so Save Victory works from the visor exactly
    // like it does from the arena end-state popup.
    moveHistory: gameRecord?.moves,
    playerColor: safePlayerColor,
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

  // Plan 3 review (F7) — surface a save confirmation toast on every
  // successful mint (first save + unlimited re-saves). Keyed on the token
  // so a re-save re-announces; the toast auto-dismisses after a few seconds.
  const [justMintedToken, setJustMintedToken] = useState<string | null>(null);
  useEffect(() => {
    if (mint.phase !== "success" || mint.data.tokenId == null) return;
    setJustMintedToken(String(mint.data.tokenId));
  }, [mint.phase, mint.data.tokenId]);

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
    // F8 — carry the outcome so the funnel can split win vs non-win saves.
    track("coach_viewer_mint_tap", {
      gameId: gameRecord.gameId,
      difficulty: gameRecord.difficulty,
      result: mapResult(gameRecord.result),
    });
    void mint.start();
  }, [mint, gameRecord]);

  const handleShare = useCallback(() => {
    if (!gameRecord) return;
    const tokenId =
      mint.data.tokenId != null ? String(mint.data.tokenId) : (gameRecord.mintedTokenId ?? null);
    // Fall back to the canonical share URL so Share is never a silent no-op
    // on loss / win-unminted (the 4-button
    // model always renders Share). Match-specific unminted share page is a
    // backlog follow-up; sharing the canonical URL is the current behavior.
    const shareLink = mint.data.shareLinkUrl ?? gameRecord.shareLinkUrl ?? SHARE_COPY.url;
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
    const tokenId =
      mint.data.tokenId != null ? String(mint.data.tokenId) : (gameRecord.mintedTokenId ?? null);
    track("coach_viewer_view_celoscan_tap", {
      gameId: gameRecord.gameId,
      tokenId: tokenId ?? undefined,
    });
    const tx = mint.data.claimTxHash ?? gameRecord.claimTxHash;
    if (tx && typeof window !== "undefined") {
      window.open(`https://celoscan.io/tx/${tx}`, "_blank", "noopener");
    }
  }, [mint.data.claimTxHash, mint.data.tokenId, gameRecord]);

  const handleBackToHub = useCallback(() => {
    track("coach_viewer_back_to_hub_tap", {
      gameId: gameRecord?.gameId ?? "unknown",
      result: gameRecord?.result ?? "unknown",
    });
    router.push("/");
  }, [router, gameRecord]);

  const handleMoveJump = useCallback(
    (ply: number) => {
      if (!gameRecord) return;
      track("coach_viewer_move_jump", { gameId: gameRecord.gameId, ply });
    },
    [gameRecord],
  );

  const handleReplayScrub = useCallback(
    (fromPly: number, toPly: number) => {
      if (!gameRecord) return;
      if (fromPly === toPly) return;
      track("coach_viewer_replay_scrub", {
        gameId: gameRecord.gameId,
        fromPly,
        toPly,
      });
    },
    [gameRecord],
  );

  const handleReplayErrorShown = useCallback(
    (atIndex: number, badSan: string) => {
      if (!gameRecord) return;
      track("coach_viewer_replay_error_shown", {
        gameId: gameRecord.gameId,
        atIndex,
        badSan,
      });
    },
    [gameRecord],
  );

  // `coach_viewer_viewed` — fires once after the route lands and the
  // wallet + record both resolve (P1-6). Ref-gated so React Strict
  // double-invocation in dev doesn't double-emit, and so cold reloads
  // that re-mount the client component still log exactly one view.
  const viewedFiredRef = useRef(false);
  // Tracks the slider's currentIndex at pointerdown so the host
  // can emit a single from→to telemetry event when the user releases.
  const scrubStartRef = useRef<number | null>(null);
  // 2026-05-30 (Bug #2 fix): when the inline analysis panel finishes
  // rendering after a loading transition, scroll it into view so the
  // user sees the result without having to hunt down the surface.
  // The slot wraps the entire inline analysis area (panel OR pending
  // banner OR cold-load card); we scroll on the loading → settled
  // edge only, so cold-load entries (already-settled phase) don't
  // pull the user past the board hero on mount.
  const inlineAnalysisRef = useRef<HTMLDivElement | null>(null);
  const prevCoachPhaseRef = useRef(coach.phase);
  useEffect(() => {
    const prev = prevCoachPhaseRef.current;
    const next = coach.phase;
    prevCoachPhaseRef.current = next;
    if (prev !== "loading") return;
    if (next !== "result" && next !== "fallback") return;
    const node = inlineAnalysisRef.current;
    if (!node) return;
    // requestAnimationFrame defers until after the panel paints so the
    // scroll target has its final dimensions.
    requestAnimationFrame(() => {
      node.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, [coach.phase]);
  // Save Later (2026-05-31): when the visor is opened from
  // /coach/history with `?focus=save`, scroll to + briefly highlight
  // the Save Victory tile so the user knows what to tap. No auto-fire
  // of the mint signature — the highlight is informational, the tap
  // stays the user's conscious action. The tile only exists in the
  // win+!claimed slate; on any other slate the querySelector returns
  // null and the effect no-ops.
  useEffect(() => {
    if (!focusSave) return;
    const settleTimer = setTimeout(() => {
      const tile = document.querySelector(
        '[data-kind="save-victory"]',
      ) as HTMLElement | null;
      if (!tile) return;
      tile.scrollIntoView({ behavior: "smooth", block: "center" });
      tile.dataset.focused = "true";
      const clearTimer = setTimeout(() => {
        delete tile.dataset.focused;
      }, 3000);
      return () => clearTimeout(clearTimer);
    }, 200);
    return () => clearTimeout(settleTimer);
  }, [focusSave]);
  useEffect(() => {
    if (viewedFiredRef.current) return;
    if (!gameRecord || !walletAddress) return;
    viewedFiredRef.current = true;
    track("coach_viewer_viewed", {
      gameId: gameRecord.gameId,
      result: gameRecord.result,
      claimed: !!gameRecord.mintedTokenId,
      hasAnalysis: !!gameRecord.analysis,
      totalMoves: gameRecord.totalMoves,
    });
  }, [gameRecord, walletAddress]);

  /**
   * NO auto-run of the real Coach API on mount. Audit 2026-06-09
   * confirmed the previous mount effect (askCoach("viewer") when
   * analysis was null + idle + wallet) silently consumed credits /
   * Peones / PRO bypass on cold-load, post-Victory-cancel navigation
   * and bookmark entries — none of them an explicit user action.
   *
   * Product rule: the real analysis MUST be user-triggered. Cached
   * analysis (`gameRecord.analysis`) still renders inline below with
   * no API call. When there is no cached analysis the viewer shows the
   * Match Review with the explicit "Ask Coach" tile (GameActionsBar);
   * tapping it runs the gated flow (Free → Peones/paywall, PRO →
   * included). Do NOT reintroduce a mount-time analyze call here.
   */

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

  // Inline analysis surface.
  // 2026-05-29 (Cluster C, commit 1): `embedded` hides the panel's own
  // Play Again / Back-to-Hub / Get-Full-Analysis CTAs — those now live
  // in the host's actions bar above, and rendering them twice was the
  // visual clutter the redesign is fixing.
  // 2026-05-30 (Bug #2 fix): priority chain reads the live `coach` hook
  // state first so the visor rehydrates IN PLACE when the user taps
  // Ask Coach. Cold-load (`gameRecord.analysis`) is the fallback for
  // direct URL entries where the analysis is already cached server-side.
  let inlineAnalysisNode: React.ReactNode = null;
  if (coach.phase === "loading") {
    inlineAnalysisNode = (
      <div
        className="coach-viewer__analysis-pending"
        role="status"
        aria-live="polite"
      >
        <span
          className="coach-viewer__analysis-pending-spinner"
          aria-hidden="true"
        />
        <p className="coach-viewer__analysis-pending-label">
          {t("analysisPending")}
        </p>
        <p className="coach-viewer__analysis-pending-hint">
          {t("analysisPendingHint")}
        </p>
      </div>
    );
  } else if (coach.phase === "result" && coach.response && coach.response.kind === "full") {
    inlineAnalysisNode = (
      <CoachPanel
        response={coach.response}
        difficulty={gameRecord.difficulty}
        totalMoves={gameRecord.totalMoves}
        elapsedMs={gameRecord.elapsedMs}
        credits={coach.credits}
        onPlayAgain={handlePlayAgain}
        onBackToHub={handleBack}
        analysisLocale={coach.analysisLocale}
        historyMeta={coach.historyMeta}
        moves={gameRecord.moves}
        embedded
      />
    );
  } else if (coach.phase === "fallback" && coach.fallbackResponse) {
    inlineAnalysisNode = (
      <CoachFallback
        response={coach.fallbackResponse}
        difficulty={gameRecord.difficulty}
        totalMoves={gameRecord.totalMoves}
        elapsedMs={gameRecord.elapsedMs}
        result={mappedResult}
        onGetFullAnalysis={handleAskCoach}
        onPlayAgain={handlePlayAgain}
        onBackToHub={handleBack}
        embedded
      />
    );
  } else if (gameRecord.analysis) {
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
          embedded
        />
      );
    } else {
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
          embedded
        />
      );
    }
  }

  // Header band meta — difficulty · moves · time. Single-line chip.
  const difficultyLabel =
    ARENA_COPY.difficulty[gameRecord.difficulty as keyof typeof ARENA_COPY.difficulty] ??
    gameRecord.difficulty;
  const movesLabel = `${gameRecord.totalMoves} ${gameRecord.totalMoves === 1 ? "move" : "moves"}`;
  const timeLabel = formatTime(gameRecord.elapsedMs);
  // Save Victory price ribbon — only meaningful on the win + !claimed
  // state, but harmless to compute up front (the actions bar ignores
  // the value in every other state).
  const claimPrice = formatVictoryPriceForDifficulty(gameRecord.difficulty);

  // Canonical header — same `<ContextualHeader>` envelope every other
  // meta surface uses (trophies, journal, legal). Subtitle carries the
  // match meta (difficulty · moves · time) so the row stays scan-able
  // without the trailing chip the previous custom band tried to fit.
  // Founder feedback 2026-06-13: the on-chain token "#N" read as a stray
  // chip floating over the board. Fold it into the meta subtitle instead,
  // where it sits as proof-of-collectible alongside the match stats.
  const headerSubtitle = tokenIdEffective
    ? `${difficultyLabel} · ${movesLabel} · ${timeLabel} · #${tokenIdEffective}`
    : `${difficultyLabel} · ${movesLabel} · ${timeLabel}`;

  return (
    <>
      <ContextualHeader
        variant="back-control"
        iconSlot={<TileIconSlot slot="hub.training" />}
        title={t("title")}
        subtitle={headerSubtitle}
        back={{ onClick: handleBack, label: t("backLabel") }}
      />

      <div className="coach-viewer">
        <div className="coach-viewer__board-frame">
          <BoardThumbnail
            fen={replay.currentFen}
            size="100%"
            ariaLabel={`Position after move ${replay.currentIndex} of ${replay.lastValidIndex}`}
          />
        </div>

        <div className="coach-viewer__chapter-break" aria-hidden="true">
          <ThemeAssetPicture slot="shared.mission-adorno" pictureClassName="coach-viewer__chapter-break-glyph" alt="" draggable={false} />
        </div>

        {/* MOVES section keeps its own badge-vitrine panel — it's a
            scrollable data table and benefits from a container that
            defines the boundary. The controls + tiles below render
            OPEN on the page (no panel) for visual breathing room
            and density contrast (Sally pass 8). */}
        <GameViewer
          moves={gameRecord.moves}
          startingFen={gameRecord.startingFen}
          replay={replay}
          hideBoardThumbnail
          onMoveJump={handleMoveJump}
        />

        {/* Floating controls — replay row + action tiles, bottom-
            anchored via `margin-top: auto`. No panel chrome; the
            tiles ARE the affordance, they don't need a frame. */}
        <div className="coach-viewer__controls">
          {replay.error && (
            <div role="alert" className="coach-viewer__replay-error">
              {t("replayStoppedAtMove", {
                n: String(replay.error.atIndex + 1),
                san: replay.error.badSan,
              })}
            </div>
          )}

          <div
            className="coach-viewer__replay"
            role="group"
            aria-label={t("controlsAriaLabel")}
          >
            <button
              type="button"
              onClick={replay.goPrev}
              disabled={!replay.canPrev}
              aria-label={t("previousMove")}
              className="coach-viewer__replay-arrow coach-viewer__replay-arrow--prev"
            >
              <ThemeAssetPicture slot="coach.play" alt="" draggable={false} />
            </button>
            <input
              type="range"
              min={0}
              max={replay.lastValidIndex}
              step={1}
              value={replay.currentIndex}
              onChange={(e) => replay.goTo(Number(e.target.value))}
              onPointerDown={() => {
                scrubStartRef.current = replay.currentIndex;
              }}
              onPointerUp={() => {
                const from = scrubStartRef.current;
                scrubStartRef.current = null;
                if (from == null) return;
                handleReplayScrub(from, replay.currentIndex);
              }}
              aria-label={t("sliderAriaLabel")}
              aria-valuetext={t("sliderProgress", {
                current: String(replay.currentIndex),
                total: String(replay.lastValidIndex),
              })}
              className="coach-viewer__replay-slider"
            />
            <button
              type="button"
              onClick={replay.goNext}
              disabled={!replay.canNext}
              aria-label={t("nextMove")}
              className="coach-viewer__replay-arrow coach-viewer__replay-arrow--next"
            >
              <ThemeAssetPicture slot="coach.play" alt="" draggable={false} />
            </button>
          </div>

          <GameActionsBar
            gameId={gameRecord.gameId}
            result={mappedResult}
            totalMoves={gameRecord.totalMoves}
            hasAnalysis={!!gameRecord.analysis || coach.phase === "result"}
            hasPartialReplayError={!!replay.error}
            mintedTokenId={tokenIdEffective}
            onAskCoach={handleAskCoach}
            onMint={handleMint}
            onShare={handleShare}
            onPlayAgain={handlePlayAgain}
            onViewNft={handleViewNft}
            onBackToHub={handleBackToHub}
            claimPrice={claimPrice}
            askCoachPending={coach.phase === "loading"}
            coachCredits={coach.credits}
            proActive={proActive}
          />
        </div>

        <div ref={inlineAnalysisRef} className="coach-viewer__analysis-slot">
          {inlineAnalysisNode}
        </div>
      </div>

      {justMintedToken && (
        <MintSuccessToast
          tokenId={justMintedToken}
          onDismiss={() => setJustMintedToken(null)}
        />
      )}
    </>
  );
}
