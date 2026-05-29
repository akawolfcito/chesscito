"use client";

import { useTranslations } from "next-intl";

type Props = {
  gameId: string;
  result: "win" | "lose" | "draw" | "resigned";
  totalMoves: number;
  hasAnalysis: boolean;
  hasPartialReplayError: boolean;
  mintedTokenId: string | null;
  shareLinkUrl: string | null;
  onAskCoach: () => void;
  onMint: () => void;
  onShare: () => void;
  onPlayAgain: () => void;
  onViewNft: () => void;
  /** 2026-05-29 (Cluster C, commit 3a): tertiary link target for the
   *  loss / draw / resigned / too-short / replay-errored states. The
   *  visor's success branch routes back to /hub via a clean push
   *  (avoids router.back loops on cold-load entries). */
  onBackToHub: () => void;
  /** 2026-05-29 (Cluster C, commit 3b): formatted price ribbon for the
   *  Save Victory primary CTA (win + !claimed state). Optional —
   *  unknown difficulty falls back to the candy-pill primary without
   *  the ribbon so the action stays reachable. */
  claimPrice?: string | null;
};

/**
 * State-driven CTA stack for the coach viewer (Cluster C, commit 3a).
 *
 * The visor's terminal screen exposes ONE primary action, up to two
 * secondaries, and an optional tertiary text link. The exact slate of
 * actions changes by game state — see the §3.1 state matrix in the
 * spec at _bmad-output/planning-artifacts/coach-viewer-cluster-c-spec-2026-05-29.md.
 *
 * Commit 3a ships the layout + non-win states with plain candy-pill
 * styling. Commit 3b replaces the Save Victory primary with the
 * gold-gradient sprite + price ribbon. Commit 3c adds the trophy
 * ribbon overlay for win+claimed and promotes View NFT to a "View on
 * Celoscan" tertiary link.
 */
export function GameActionsBar({
  result,
  totalMoves,
  hasAnalysis,
  hasPartialReplayError,
  mintedTokenId,
  shareLinkUrl,
  onAskCoach,
  onMint,
  onShare,
  onPlayAgain,
  onViewNft,
  onBackToHub,
  claimPrice,
}: Props) {
  const t = useTranslations("COACH_VIEWER_COPY");
  const isWin = result === "win";
  const isMinted = mintedTokenId != null;
  const isTooShort = totalMoves === 0;
  const askCoachDisabled = hasPartialReplayError || isTooShort;
  const askCoachLabel = hasAnalysis ? t("askCoachAgain") : t("askCoach");

  // State derivation per spec §3.1. Order matters: too-short and
  // replay-errored short-circuit ahead of win-state branches so a
  // partial-replay error on a winning game lands on the "fix it" path,
  // not the mint path.
  let primary: React.ReactNode;
  let secondaries: React.ReactNode[] = [];
  let tertiary: React.ReactNode = null;

  if (isTooShort) {
    primary = (
      <button
        type="button"
        onClick={onPlayAgain}
        className="coach-viewer__actions-primary"
        aria-label={t("playAgain")}
      >
        {t("playAgain")}
      </button>
    );
    tertiary = (
      <button
        type="button"
        onClick={onBackToHub}
        className="coach-viewer__actions-tertiary"
      >
        {t("backToHub")}
      </button>
    );
  } else if (isWin && !isMinted) {
    // Save Victory primary — `.cta-principal` sprite + sticker save
    // icon + corner price ribbon. Mirrors the arena end-state popup's
    // treasure CTA verbatim (spec §6 visual rhyme). Falls back to a
    // plain candy-pill primary when the difficulty doesn't resolve to
    // a known tier — keeps the mint flow reachable for safety.
    const saveLabel = t("saveVictory");
    const ariaLabel = claimPrice
      ? t("saveVictoryAriaLabel", { price: claimPrice })
      : saveLabel;
    primary = (
      <button
        type="button"
        onClick={onMint}
        aria-label={ariaLabel}
        className="coach-viewer__actions-primary coach-viewer__actions-primary--treasure"
      >
        <picture className="coach-viewer__actions-primary-icon">
          <source srcSet="/art/new-icons-chesscito/save.avif" type="image/avif" />
          <source srcSet="/art/new-icons-chesscito/save.webp" type="image/webp" />
          <img src="/art/new-icons-chesscito/save.png" alt="" draggable={false} />
        </picture>
        <span className="coach-viewer__actions-primary-label">{saveLabel}</span>
        {claimPrice && (
          <span
            className="coach-viewer__actions-primary-price-ribbon"
            aria-hidden="true"
          >
            {claimPrice}
          </span>
        )}
      </button>
    );
    secondaries = [
      <button
        key="ask"
        type="button"
        onClick={onAskCoach}
        disabled={askCoachDisabled}
        className="coach-viewer__actions-secondary"
        aria-label={askCoachLabel}
      >
        {askCoachLabel}
      </button>,
      <button
        key="play"
        type="button"
        onClick={onPlayAgain}
        className="coach-viewer__actions-secondary"
        aria-label={t("playAgain")}
      >
        {t("playAgain")}
      </button>,
    ];
  } else if (isWin && isMinted) {
    // Trophy ribbon + dedicated "View on Celoscan" tertiary land in
    // commit 3c. For 3a, View NFT becomes a tertiary text link so the
    // win+claimed state has a coherent stack today.
    const winClaimedPrimary = hasAnalysis ? onPlayAgain : onAskCoach;
    const winClaimedPrimaryLabel = hasAnalysis ? t("playAgain") : askCoachLabel;
    primary = (
      <button
        type="button"
        onClick={winClaimedPrimary}
        disabled={!hasAnalysis && askCoachDisabled}
        className="coach-viewer__actions-primary"
        aria-label={winClaimedPrimaryLabel}
      >
        {winClaimedPrimaryLabel}
      </button>
    );
    secondaries = [
      ...(shareLinkUrl
        ? [
            <button
              key="share"
              type="button"
              onClick={onShare}
              className="coach-viewer__actions-secondary"
              aria-label={t("share")}
            >
              {t("share")}
            </button>,
          ]
        : []),
      <button
        key="alt"
        type="button"
        onClick={hasAnalysis ? onAskCoach : onPlayAgain}
        disabled={!hasAnalysis ? false : askCoachDisabled}
        className="coach-viewer__actions-secondary"
        aria-label={hasAnalysis ? askCoachLabel : t("playAgain")}
      >
        {hasAnalysis ? askCoachLabel : t("playAgain")}
      </button>,
    ];
    tertiary = (
      <button
        type="button"
        onClick={onViewNft}
        className="coach-viewer__actions-tertiary"
        aria-label={t("viewOnCeloscan")}
      >
        {t("viewOnCeloscan")}
      </button>
    );
  } else {
    // loss / draw / resigned / replay-errored — same stack: Ask Coach
    // primary (disabled with banner via GameViewer when errored), Play
    // again secondary, Back to Hub tertiary.
    primary = (
      <button
        type="button"
        onClick={onAskCoach}
        disabled={askCoachDisabled}
        className="coach-viewer__actions-primary"
        aria-label={askCoachLabel}
      >
        {askCoachLabel}
      </button>
    );
    secondaries = [
      <button
        key="play"
        type="button"
        onClick={onPlayAgain}
        className="coach-viewer__actions-secondary"
        aria-label={t("playAgain")}
      >
        {t("playAgain")}
      </button>,
    ];
    tertiary = (
      <button
        type="button"
        onClick={onBackToHub}
        className="coach-viewer__actions-tertiary"
      >
        {t("backToHub")}
      </button>
    );
  }

  return (
    <div
      className="coach-viewer__actions"
      role="group"
      aria-label={t("actionsAriaLabel")}
    >
      {primary}
      {secondaries.length > 0 && (
        <div
          className="coach-viewer__actions-secondary-row"
          data-count={secondaries.length}
        >
          {secondaries}
        </div>
      )}
      {tertiary}
    </div>
  );
}
