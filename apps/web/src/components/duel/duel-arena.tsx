"use client";

import { Chess } from "chess.js";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { ArenaBoard } from "@/components/arena/arena-board";
import { ArenaMatchupTransition } from "@/components/arena/arena-matchup-transition";
import { PrimaryPlayCta } from "@/components/kingdom/primary-play-cta";
import { ArenaConfirmModal } from "@/components/arena/arena-confirm-modal";
import { PromotionOverlay } from "@/components/arena/promotion-overlay";
import { DuelClock } from "@/components/duel/duel-clock";
import { DuelEndOverlay } from "@/components/duel/duel-end-overlay";
import { DuelLobby, useDuelLobbySlides } from "@/components/duel/duel-lobby";
import { isBoardInteractive, type DuelArenaState } from "@/lib/duel/arena-state";
import { DUEL_INTRO_MS, shouldPlayIntro } from "@/lib/duel/intro";
import { duelBoardView } from "@/lib/duel/board-view";
import { duelShareUrl } from "@/lib/duel/link";
import { outcomeCopyKey } from "@/lib/duel/outcome-copy";
import { useDuel } from "@/lib/duel/use-duel";
import type { DuelColor, DuelPublic } from "@/lib/duel/types";
import { fenToPieces } from "@/lib/game/arena-utils";
import type { ChessBoardPiece } from "@/lib/game/types";

/**
 * The duel, on the Arena surface.
 *
 * ⛔ Every screen state comes from `duelArenaState`, which is a pure function of
 * what the SERVER said. Nothing here keeps a parallel idea of whose turn it is
 * or whether the game is over: a screen state the server cannot reconstruct is
 * one that survives a reload as a lie.
 *
 * What this file owns is exactly two things the server cannot: which square the
 * player has tapped, and whether the promotion picker is open. Both are
 * discarded the moment a move lands.
 */

type Props = {
  duelId: string;
  locale: string;
  sessionId?: string | null;
  onExit: () => void;
};

type PendingPromotion = { from: string; to: string };

export function DuelArena({ duelId, locale, sessionId, onExit }: Props) {
  const t = useTranslations("DUEL_COPY");
  const tArena = useTranslations("ARENA_COPY");
  const { state, notice, busy, join, move, resign, refresh } = useDuel(duelId, {
    sessionId,
  });

  const [selected, setSelected] = useState<string | null>(null);
  const [promotion, setPromotion] = useState<PendingPromotion | null>(null);
  const [resignOpen, setResignOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [endDismissed, setEndDismissed] = useState(false);
  /** ⛔ Vacio significa "mostra el tablero". Ver duel-lobby.tsx. */
  const lobbySlideSources = useDuelLobbySlides(locale);

  const duel = "duel" in state ? state.duel : null;
  const interactive = isBoardInteractive(state);

  /** chess.js on the CURRENT position, for highlighting only. ⚠️ The client
   *  filters for UX; its opinion never counts (behaviour 9). The server is the
   *  referee, and it re-checks every move. */
  const chess = useMemo(() => {
    if (!duel) return null;
    try {
      return new Chess(duel.fen);
    } catch {
      return null;
    }
  }, [duel]);

  /** Memoized on the position: the replay is cheap but not free. */
  const boardView = useMemo(
    () => (duel ? duelBoardView(duel.fen, duel.moves) : { lastMove: null, checkSquare: null }),
    [duel],
  );

  const legalMoves = useMemo(() => {
    if (!chess || !selected || !interactive) return [];
    return chess
      .moves({ square: selected as never, verbose: true })
      .map((m) => (m as { to: string }).to);
  }, [chess, interactive, selected]);

  const send = useCallback(
    async (from: string, to: string, promotionPiece?: "q" | "r" | "b" | "n") => {
      if (!chess) return;
      let san: string;
      try {
        // Ask chess.js for the SAN of this move on a THROWAWAY copy — the real
        // position only ever changes when the server says so.
        const scratch = new Chess(chess.fen());
        const played = scratch.move({ from, to, promotion: promotionPiece });
        if (!played) return;
        san = played.san;
      } catch {
        return;
      }
      setSelected(null);
      setPromotion(null);
      await move(san);
    },
    [chess, move],
  );

  const onSquareClick = useCallback(
    (square: string) => {
      if (!interactive || !chess || busy) return;

      if (selected && legalMoves.includes(square)) {
        // ⛔ Promotion is asked BEFORE sending: the SAN carries the piece
        // (`e8=Q`), so without the choice the move is irreproducible.
        if (isPromotion(chess, selected, square)) {
          setPromotion({ from: selected, to: square });
          return;
        }
        void send(selected, square);
        return;
      }

      const piece = chess.get(square as never);
      setSelected(piece && piece.color === chess.turn() ? square : null);
    },
    [busy, chess, interactive, legalMoves, selected, send],
  );

  /**
   * The matchup screen, on the transition and not on the state.
   *
   * ⛔ `previousKind` is what makes it fire once. Keyed on "the duel is active"
   * instead, it would replay "Get ready!" on every reload of a game already
   * forty moves deep, and on every poll that re-rendered.
   */
  const [showIntro, setShowIntro] = useState(false);
  const previousKind = useRef<DuelArenaState["kind"] | null>(null);

  useEffect(() => {
    const previous = previousKind.current;
    previousKind.current = state.kind;
    if (!shouldPlayIntro(previous, state.kind)) return;

    setShowIntro(true);
    const timer = setTimeout(() => setShowIntro(false), DUEL_INTRO_MS);
    return () => clearTimeout(timer);
  }, [state.kind]);

  const shareLink = useMemo(() => {
    if (typeof window === "undefined") return "";
    // ⛔ From the ID and the PLAY host, never from the address bar. Both reasons
    // were measured on a phone: the post-login URL carries the inviter's
    // `privy_oauth_code`, and a relative link bounces cross-domain out of LEARN
    // where the seat cookie does not travel.
    return duelShareUrl(duelId, locale, new URL(window.location.href));
  }, [duelId, locale]);

  const onShare = useCallback(async () => {
    try {
      if (typeof navigator !== "undefined" && navigator.share) {
        // ⚠️ `title` and `text` alongside the url: some share targets render a
        // bare url as an attachment rather than as a message, and a few queue
        // it instead of sending it. It costs nothing and gives the receiving
        // app something to show.
        await navigator.share({
          title: t("setupTitle"),
          text: t("invitingBody"),
          url: shareLink,
        });
        return;
      }
      await navigator.clipboard.writeText(shareLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2_500);
    } catch {
      // A cancelled share sheet is not a failure, and a clipboard a browser
      // refuses is not worth an error screen: the link is on screen anyway.
    }
  }, [shareLink]);

  if (showIntro && duel) {
    // Same matchup screen and the same 1.8s beat as the AI match: the duel is a
    // second kind of rival on the same surface, so the moment two players sit
    // down should feel like the moment PLAY already established.
    return (
      <ArenaMatchupTransition
        rivalName={
          duel.seats[topSeat(duel.you)].displayName ?? t("rivalFallbackName")
        }
        rivalAvatarSrc=""
        rivalAvatarSlot="shared.avatar-small-account"
        // ⚠️ Silver is the neutral frame. The other two are the colours of the
        // easy and hard AI rivals, and a human is neither.
        rivalFrame="silver"
        playerLabel={tArena("you")}
        playerNickname={duel.seats[bottomSeat(duel.you)].displayName ?? undefined}
        playerAvatarSrc=""
        playerAvatarSlot="arena.player-you"
        getReadyLabel={tArena("getReady")}
      />
    );
  }

  if (state.kind === "loading") {
    return <div className="duel-arena duel-arena-loading" aria-busy="true" />;
  }

  if (state.kind === "missing") {
    return (
      <section className="duel-arena">
        <h1 className="duel-title">{t("missingTitle")}</h1>
        <p className="duel-body">{t("missingBody")}</p>
        <PrimaryPlayCta surface="arena-entry" label={t("backToPlay")} ariaLabel={t("backToPlay")} onPress={onExit} />
      </section>
    );
  }

  const you = state.duel.you;

  /**
   * ⛔ Only while WAITING, and only if an image actually exists.
   *
   * The lobby replaces the board on the one screen where no clock is running,
   * so it costs nobody a second. ⚠️ The emptiness check is the HOOK's answer,
   * not the component's: a component that renders `null` is still a truthy
   * element to its caller, so asking it here is what keeps the board as the
   * real fallback.
   */
  const showLobby = state.kind === "inviting" && lobbySlideSources.length > 0;

  return (
    <section className="duel-arena" data-duel-state={state.kind}>
      <header className="duel-header">
        <DuelClock
          duel={state.duel}
          seat={topSeat(you)}
          label={seatName(state.duel, topSeat(you))}
          frozen={busy}
          onReachedZero={refresh}
        />
        <p className="duel-status">{headline(state.kind, state.duel, you, t)}</p>
        <DuelClock
          duel={state.duel}
          seat={bottomSeat(you)}
          label={seatName(state.duel, bottomSeat(you))}
          frozen={busy}
          onReachedZero={refresh}
        />
      </header>

      {showLobby ? (
        <DuelLobby slides={lobbySlideSources} alt={t("invitingTitle")} />
      ) : (
      <ArenaBoard
        pieces={piecesOf(state.duel.fen)}
        selectedSquare={selected}
        legalMoves={legalMoves}
        // ⛔ The trail and the check square. Shipping these as `null` cost the
        // duel the movement trail the AI arena already had, which is the kind
        // of regression no test catches because nothing asserts on a tint.
        lastMove={boardView.lastMove}
        checkSquare={boardView.checkSquare}
        isLocked={!interactive || busy}
        onSquareClick={onSquareClick}
        // ⚠️ A player seated on black reads the board from black's side. The
        // spectator keeps white's view, which is the neutral one.
        playerColor={you ?? "w"}
      />
      )}

      {notice ? (
        <p className="duel-notice" role="status">
          {t(noticeKey(notice))}
        </p>
      ) : null}

      {state.kind === "inviting" ? (
        <footer className="duel-footer">
          <p className="duel-body">{t("invitingBody")}</p>
          <PrimaryPlayCta surface="arena-entry" label={copied ? t("invitingCopied") : t("invitingShare")} ariaLabel={t("invitingShare")} onPress={() => void onShare()} />
          <p className="duel-hint">{t("invitingExpiry")}</p>
        </footer>
      ) : null}

      {state.kind === "invited" ? (
        <footer className="duel-footer">
          <p className="duel-body">{t("invitedBody")}</p>
          <PrimaryPlayCta surface="arena-entry" label={busy ? t("invitedJoining") : t("invitedJoin")} ariaLabel={t("invitedJoin")} loading={busy} onPress={() => void join()} />
        </footer>
      ) : null}

      {state.kind === "your-turn" || state.kind === "their-turn" ? (
        <footer className="duel-footer">
          <button
            type="button"
            className="duel-secondary"
            onClick={() => setResignOpen(true)}
          >
            {t("resign")}
          </button>
        </footer>
      ) : null}

      {state.kind === "finished" || state.kind === "expired" ? (
        <footer className="duel-footer">
          <p className="duel-body">
            {state.kind === "expired"
              ? t("expiredBody")
              : t(outcomeCopyKey(state.duel.outcome, you))}
          </p>
          <PrimaryPlayCta
            surface="arena-entry"
            label={t("backToPlay")}
            ariaLabel={t("backToPlay")}
            onPress={onExit}
          />
        </footer>
      ) : null}

      {promotion ? (
        <PromotionOverlay
          onSelect={(piece) => void send(promotion.from, promotion.to, piece)}
          // ⛔ Cancelling sends NOTHING and clears the selection: a promotion
          // without a chosen piece is not a move.
          onCancel={() => {
            setPromotion(null);
            setSelected(null);
          }}
        />
      ) : null}

      {/* ⚠️ Dismissable on purpose. The board underneath is the final position,
          and a player who wants to look at it should not have to leave the duel
          to do it. Closing does not end anything: the duel is already over. */}
      {state.kind === "finished" && !endDismissed ? (
        <DuelEndOverlay
          duel={state.duel}
          you={you}
          onExit={onExit}
          onClose={() => setEndDismissed(true)}
        />
      ) : null}

      <ArenaConfirmModal
        open={resignOpen}
        title={t("resignConfirmTitle")}
        body={t("resignConfirmBody")}
        confirmLabel={t("resignConfirm")}
        cancelLabel={t("resignCancel")}
        closeAriaLabel={t("resignCancel")}
        onConfirm={() => {
          setResignOpen(false);
          void resign();
        }}
        onCancel={() => setResignOpen(false)}
      />
    </section>
  );
}

/** The player's own seat sits at the bottom; a spectator keeps white's view. */
function bottomSeat(you: DuelColor | null): DuelColor {
  return you ?? "w";
}

function topSeat(you: DuelColor | null): DuelColor {
  return bottomSeat(you) === "w" ? "b" : "w";
}

function seatName(duel: DuelPublic, seat: DuelColor): string {
  return duel.seats[seat].displayName ?? "";
}

function piecesOf(fen: string): ChessBoardPiece[] {
  // ⚠️ The id is derived from the square rather than tracked across moves, so a
  // moving piece remounts instead of sliding. Correct, and the animation is a
  // refinement the duel does not need to ship with.
  return fenToPieces(fen).map((piece) => ({
    ...piece,
    id: `${piece.color}${piece.type}-${piece.square}`,
  })) as ChessBoardPiece[];
}

function isPromotion(chess: Chess, from: string, to: string): boolean {
  const piece = chess.get(from as never);
  if (!piece || piece.type !== "p") return false;
  return to.endsWith(piece.color === "w" ? "8" : "1");
}

function headline(
  kind: string,
  duel: DuelPublic,
  you: DuelColor | null,
  t: (key: string, values?: Record<string, string>) => string,
): string {
  switch (kind) {
    case "inviting":
      return t("invitingTitle");
    case "invited": {
      const inviter = duel.seats.w.displayName ?? duel.seats.b.displayName;
      return inviter
        ? t("invitedTitle", { name: inviter })
        : t("invitedTitleAnonymous");
    }
    case "your-turn":
      return t("yourTurn");
    case "their-turn":
      return t("theirTurn");
    case "watching":
      return t("watching");
    case "expired":
      return t("expiredTitle");
    case "finished":
      return t(outcomeCopyKey(duel.outcome, you));
    default:
      return "";
  }
}

function noticeKey(notice: string): string {
  switch (notice) {
    case "illegal-move":
      return "noticeIllegalMove";
    case "not-your-turn":
      return "noticeNotYourTurn";
    case "version-conflict":
      return "noticeVersionConflict";
    case "seat-taken":
      return "noticeSeatTaken";
    case "expired":
      return "noticeExpired";
    case "network":
      return "noticeNetwork";
    default:
      return "noticeUnavailable";
  }
}
