"use client";

import { LottieAnimation } from "@/components/ui/lottie-animation";
import { PlayerAvatar } from "@/components/redesign/player-avatar";

/** Which side of the board this rail belongs to. The rival sits above the
 *  board, the player below it — matching where their own pieces are, since
 *  ArenaBoard flips for a black player (`arena-board.tsx`: flipped =
 *  playerColor === "b"). Position therefore encodes the piece color, which is
 *  why no White/Black label is rendered. */
export type ArenaRailSide = "rival" | "you";

type Props = {
  side: ArenaRailSide;
  /** "You", or the rival persona (Pipo / Mara / Kairo). */
  name: string;
  /** Second line. Rival: "Easy · 477 ELO". Player: the Identity Lite
   *  nickname. Undefined for a visitor (no nickname) — the line is dropped
   *  but the rail keeps its height, so the board does not shift vertically
   *  between a connected and a disconnected session. */
  meta?: string;
  /** Turn emphasis. Exactly one rail is active during play; NEITHER is active
   *  in end-state — the match is over and the HUD must not imply someone is
   *  still to move. */
  isActive?: boolean;
  /** Rival only — the "thinking" animation anchored to the avatar. */
  isThinking?: boolean;
  /** Rival persona sprite (full `.png` path); the avif/webp siblings are
   *  derived by PlayerAvatar. */
  avatarSrc?: string;
  /** Is the player a PRO subscriber? Draws the ornamental frame behind BOTH
   *  avatars (spec §4). Arrives as a prop — the rail must stay presentational.
   *  It used to call `useIsProActive()` itself, which reaches into wagmi, so
   *  the rail threw without a WagmiProvider and could not be mounted in the
   *  /dev VR fixtures (whose layout mounts no wallet stack). That is why the
   *  rails were the one surface with no visual baseline. */
  pro?: boolean;
};

/** Compact identity strip for one side of the match.
 *
 *  Deliberately NOT interactive — no onClick, no button role. The chip this
 *  replaces was a <button> wired straight to `game.reset()` with no
 *  confirmation, so a tap on what read as an info chip silently destroyed the
 *  match. Changing difficulty now goes through the back chip's confirm modal
 *  and the rival selector. See spec §5. */
export function ArenaPlayerRail({
  side,
  name,
  meta,
  isActive = false,
  isThinking = false,
  avatarSrc,
  pro = false,
}: Props) {
  return (
    <div
      className={`arena-rail arena-rail--${side}${isActive ? " is-active" : ""}`}
    >
      <span className="arena-rail-avatar">
        <PlayerAvatar
          variant={side === "rival" ? "bot" : "you"}
          pro={pro}
          customSrc={avatarSrc}
          alt={name}
          className="h-14 w-14"
        />
        {isThinking ? (
          <span className="arena-rail-thinking" aria-hidden="true">
            <LottieAnimation
              src="/animations/sandy-loading.lottie"
              loop
              className="h-full w-full"
            />
          </span>
        ) : null}
      </span>

      <span className="arena-rail-text">
        <span className="arena-rail-name">{name}</span>
        {meta ? <span className="arena-rail-meta">{meta}</span> : null}
      </span>
    </div>
  );
}
