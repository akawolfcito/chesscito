"use client";

/* ── CelebrationStack ──────────────────────────────────────────────
 * The arched headline + wolf, as ONE component.
 *
 * This block shipped twice — once in the exercises PhaseFlash, once
 * copy-pasted into the Daily sheet — and the copies drifted the moment the
 * original was tuned. The Daily kept the `-mb-6` and the 20rem wolf that
 * exercises had already been corrected away from (founder, 2026-07-29), and
 * never mounted the lesson line at all, so it did not even reserve the
 * two-line box the headline is positioned against. Same art, same intent,
 * two different geometries, and only one of them the approved one.
 *
 * Every measurement below is load-bearing and is explained where it sits.
 * Callers pass content and effects; they do not pass sizes. That is the
 * point — a new surface that wants this celebration gets the corrected
 * geometry for free and cannot fork it by omission.
 * ----------------------------------------------------------------- */

import type { CSSProperties, ReactNode } from "react";

import { ArchedHeadline } from "@/components/ui/arched-headline";
import { ThemeAssetPicture } from "@/components/themes/theme-asset-picture";

/** The two celebration avatars, as theme slots. Both resolve to the same
 *  `/art/avatar-*` files the raw <picture> used to hard-code, so the default
 *  theme is unchanged — and a PRO theme now reaches the exercises overlay too,
 *  which it could not while that surface bypassed the resolver. */
export type CelebrationAvatarSlot =
  | "exercises.avatar-fun"
  | "exercises.avatar-try-again";

const HEADLINE_ENTER =
  "reward-icon-enter 380ms cubic-bezier(0.34, 1.56, 0.64, 1) both";
const LESSON_ENTER =
  "reward-icon-enter 320ms cubic-bezier(0.34, 1.56, 0.64, 1) 180ms both";
const AVATAR_ENTER =
  "reward-icon-enter 320ms cubic-bezier(0.34, 1.56, 0.64, 1) 120ms both";

export type CelebrationStackProps = {
  /** The already-translated headline. */
  text: string;
  /** Dark edge painted outside the outline. */
  stroke: string;
  /** Thick outline colour hugging the letters. */
  accent: string;
  avatarSlot: CelebrationAvatarSlot;
  /** The "You learned: …" line. Its BOX is reserved whether or not there is
   *  anything to say — see the span below. */
  lesson?: ReactNode;
  /** Effects layered inside the wolf's frame (confetti, sparkle burst).
   *  Optional so a surface can take the geometry without the fireworks. */
  children?: ReactNode;
  style?: CSSProperties;
};

export function CelebrationStack({
  text,
  stroke,
  accent,
  avatarSlot,
  lesson,
  children,
  style,
}: CelebrationStackProps) {
  return (
    <div className="relative animate-in zoom-in-90 duration-300" style={style}>
      {/* NO bottom margin, positive or negative (founder 2026-07-29). This
          block hangs above the wolf and grows upward, so a negative margin
          buys headroom for the arch by pushing the lesson line down INTO the
          wolf — exactly the collision it was meant to avoid, just moved to
          the other end. The headroom comes from the wolf's own size below
          instead, and the two never overlap by construction.

          Centring lives on this wrapper, not on the headline: an absolutely
          positioned headline shrink-wraps to its own glyphs, so
          -translate-x-1/2 pulled it back by the wrong half and the last
          letters ran off the right edge.

          The explicit viewport width IS load-bearing: the containing block
          here is the wolf's frame, so an auto-width absolute child can never
          get wider than that however big its own max-width is, and the lesson
          wrapped early with half the screen empty beside it. */}
      <div className="pointer-events-none absolute bottom-full left-1/2 flex w-[92vw] -translate-x-1/2 flex-col items-center gap-1">
        <ArchedHeadline
          text={text}
          stroke={stroke}
          accent={accent}
          style={{
            fontSize: "clamp(2.75rem, 13vw, 4.25rem)",
            animation: HEADLINE_ENTER,
          }}
        />
        {/* Rendered even with nothing to say, so the two-line box it reserves
            exists in EVERY phase and the headline lands on the same pixel
            whether the player just won, just failed, or is on a surface that
            carries no lesson at all. Gating the element itself puts the jump
            back — one line shorter wherever it is absent. */}
        <span className="overlay-lesson" style={{ animation: LESSON_ENTER }}>
          {lesson ?? null}
        </span>
      </div>
      {/* 13.5rem, down from 20rem (founder 2026-07-29; 12rem overshot). This
          is the only knob that buys headroom without a cost somewhere else:
          the whole stack is centred in the scrim, so every rem the wolf gives
          back is half a rem of clearance at the top for the arch. Moving it
          down instead would run it into the reward pills and the tap prompt;
          cropping the art would change the avatar for every other surface
          that uses it. It still carries the emotion at this size — what it
          stopped doing is crowd the words. */}
      <div className="relative flex h-[13.5rem] w-[13.5rem] items-center justify-center">
        {children}
        <div
          className="pointer-events-none absolute h-[12.5rem] w-[12.5rem] rounded-full"
          style={{
            background:
              "radial-gradient(circle, rgba(245, 158, 11, 0.32) 0%, rgba(245, 158, 11, 0.10) 55%, transparent 80%)",
          }}
        />
        <ThemeAssetPicture
          slot={avatarSlot}
          pictureClassName="relative z-10"
          alt=""
          aria-hidden="true"
          className="h-[12.5rem] w-[12.5rem] object-contain drop-shadow-[0_6px_22px_rgba(255,245,215,0.95)]"
          style={{ animation: AVATAR_ENTER }}
        />
      </div>
    </div>
  );
}
