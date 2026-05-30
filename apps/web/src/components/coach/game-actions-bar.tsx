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
   *  unknown difficulty hides the ribbon but keeps the tile reachable. */
  claimPrice?: string | null;
  /** 2026-05-30 (Bug #2 fix): the coach hook is currently running an
   *  analysis. The Ask Coach tile renders a spinner overlay, swaps to
   *  a "Analyzing…" label, and becomes disabled so repeated taps don't
   *  re-trigger requestCoachAnalyze. Other tiles stay reachable. */
  askCoachPending?: boolean;
  /** 2026-05-30 (Phase 2 shop oscuridad): remaining paid coach credits
   *  in the wallet. When > 0, the bar renders a tertiary "Uses 1 credit
   *  · {count} left" hint under the Ask Coach tile so users can track
   *  spend at the point of action. Suppressed at 0 (paywall takes over)
   *  or while the analysis is pending (hint would compete with spinner). */
  coachCredits?: number;
};

type TileKind = "play-again" | "save-victory" | "ask-coach" | "share";

type Tile = {
  kind: TileKind;
  label: string;
  ariaLabel?: string;
  onClick: () => void;
  disabled?: boolean;
  /** Optional price ribbon on the tile's top-right corner. Reserved
   *  for the Save Victory tile in the win + !claimed state. */
  priceRibbon?: string;
  /** 2026-05-30 (Bug #2 fix): render a spinner overlay on the tile icon.
   *  Drives `data-loading="true"` on the button — the CSS handles the
   *  spinning ring + dimming. Only the Ask Coach tile uses it today. */
  pending?: boolean;
};

const TILE_ICON: Record<TileKind, { avif: string; webp: string; png: string }> = {
  "play-again": {
    avif: "/art/new-assets-chesscito/btns/play-again-icon.avif",
    webp: "/art/new-assets-chesscito/btns/play-again-icon.webp",
    png: "/art/new-assets-chesscito/btns/play-again-icon.png",
  },
  "save-victory": {
    avif: "/art/new-icons-chesscito/save.avif",
    webp: "/art/new-icons-chesscito/save.webp",
    png: "/art/new-icons-chesscito/save.png",
  },
  "ask-coach": {
    avif: "/art/new-assets-chesscito/btns/ask-coach-icon.avif",
    webp: "/art/new-assets-chesscito/btns/ask-coach-icon.webp",
    png: "/art/new-assets-chesscito/btns/ask-coach-icon.png",
  },
  share: {
    avif: "/art/action-row/trofeo-epico.avif",
    webp: "/art/action-row/trofeo-epico.webp",
    png: "/art/action-row/trofeo-epico.png",
  },
};

/**
 * State-driven CTA tiles for the coach viewer (Cluster C, M3).
 *
 * Replaces the previous primary-secondary-tertiary stack with a flat
 * row of 1–3 equal-width tiles (icon canvas + label below). Save
 * Victory keeps its corner price ribbon so the cost signal survives
 * the visual flatten. Tertiaries (Back to Hub, View on Celoscan) stay
 * as text links underneath the row.
 *
 * Per-state slate:
 *   - too-short          → [Play Again]                 + Back to Hub
 *   - replay-errored     → [Play Again, Ask Coach(off)] + Back to Hub
 *   - win + !claimed     → [Play Again, Save Victory($), Ask Coach]
 *   - win + claimed      → [Play Again, Share trophy, Ask Coach]
 *                                                       + View on Celoscan
 *   - loss/draw/resigned → [Play Again, Ask Coach]      + Back to Hub
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
  askCoachPending,
  coachCredits,
}: Props) {
  const t = useTranslations("COACH_VIEWER_COPY");
  const isWin = result === "win";
  const isMinted = mintedTokenId != null;
  const isTooShort = totalMoves === 0;
  const askCoachDisabled = hasPartialReplayError || isTooShort || !!askCoachPending;
  // Credits hint fires only when the Ask Coach tile is actually reachable
  // (not too-short, not replay-errored, not currently analyzing) AND the
  // wallet holds paid credits. Zero suppresses the hint so the paywall
  // stays the primary signal for an empty balance.
  const showCreditsHint =
    !isTooShort &&
    !hasPartialReplayError &&
    !askCoachPending &&
    typeof coachCredits === "number" &&
    coachCredits > 0;
  const askCoachLabel = askCoachPending
    ? t("analysisPending")
    : hasAnalysis
      ? t("askCoachAgain")
      : t("askCoach");

  const playAgainTile: Tile = {
    kind: "play-again",
    label: t("playAgain"),
    onClick: onPlayAgain,
  };
  const askCoachTile: Tile = {
    kind: "ask-coach",
    label: askCoachLabel,
    onClick: onAskCoach,
    disabled: askCoachDisabled,
    pending: !!askCoachPending,
  };

  let tiles: Tile[];
  let tertiary: React.ReactNode = null;

  if (isTooShort) {
    tiles = [playAgainTile];
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
    tiles = [
      playAgainTile,
      {
        kind: "save-victory",
        label: t("saveVictory"),
        ariaLabel: claimPrice
          ? t("saveVictoryAriaLabel", { price: claimPrice })
          : t("saveVictory"),
        onClick: onMint,
        priceRibbon: claimPrice ?? undefined,
      },
      askCoachTile,
    ];
  } else if (isWin && isMinted) {
    tiles = [
      playAgainTile,
      ...(shareLinkUrl
        ? [
            {
              kind: "share" as const,
              label: t("shareTrophy"),
              onClick: onShare,
            },
          ]
        : []),
      askCoachTile,
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
    // loss / draw / resigned / replay-errored
    tiles = [playAgainTile, askCoachTile];
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
      <div
        className="coach-viewer__tiles-row"
        data-count={tiles.length}
      >
        {tiles.map((tile) => {
          const icon = TILE_ICON[tile.kind];
          return (
            <button
              key={tile.kind}
              type="button"
              onClick={tile.onClick}
              disabled={tile.disabled}
              aria-label={tile.ariaLabel ?? tile.label}
              aria-busy={tile.pending || undefined}
              className="coach-viewer__tile"
              data-kind={tile.kind}
              data-loading={tile.pending || undefined}
            >
              {tile.priceRibbon && (
                <span
                  className="coach-viewer__tile-price-ribbon"
                  aria-hidden="true"
                >
                  {tile.priceRibbon}
                </span>
              )}
              <picture className="coach-viewer__tile-icon">
                <source srcSet={icon.avif} type="image/avif" />
                <source srcSet={icon.webp} type="image/webp" />
                <img src={icon.png} alt="" draggable={false} />
              </picture>
              {tile.pending && (
                <span
                  className="coach-viewer__tile-spinner"
                  aria-hidden="true"
                />
              )}
              <span className="coach-viewer__tile-label">{tile.label}</span>
            </button>
          );
        })}
      </div>
      {showCreditsHint && (
        <p
          className="coach-viewer__credits-hint"
          role="status"
          aria-live="off"
        >
          {t("creditsHint", { count: coachCredits as number })}
        </p>
      )}
      {tertiary}
    </div>
  );
}
