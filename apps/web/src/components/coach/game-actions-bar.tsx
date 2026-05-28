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
};

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
}: Props) {
  const t = useTranslations("COACH_VIEWER_COPY");
  const isWin = result === "win";
  const isMinted = mintedTokenId != null;
  const isTooShort = totalMoves === 0;
  const coachDisabled = hasPartialReplayError || isTooShort;

  return (
    <div className="game-actions-bar" role="group" aria-label={t("actionsAriaLabel")}>
      <button
        type="button"
        onClick={onAskCoach}
        disabled={coachDisabled}
        className="game-actions-bar__cta game-actions-bar__cta--ask-coach"
      >
        {hasAnalysis ? t("askCoachAgain") : t("askCoach")}
      </button>

      {isWin && !isMinted && (
        <button
          type="button"
          onClick={onMint}
          className="game-actions-bar__cta game-actions-bar__cta--mint"
        >
          {t("mintVictory")}
        </button>
      )}

      {isWin && isMinted && (
        <button
          type="button"
          onClick={onViewNft}
          className="game-actions-bar__cta game-actions-bar__cta--view-nft"
        >
          {t("viewNft")}
        </button>
      )}

      {isWin && isMinted && shareLinkUrl && (
        <button
          type="button"
          onClick={onShare}
          className="game-actions-bar__cta game-actions-bar__cta--share"
        >
          {t("share")}
        </button>
      )}

      <button
        type="button"
        onClick={onPlayAgain}
        className="game-actions-bar__cta game-actions-bar__cta--play-again"
      >
        {t("playAgain")}
      </button>
    </div>
  );
}
