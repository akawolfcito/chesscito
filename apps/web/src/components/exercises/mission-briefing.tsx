"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ARENA_COPY, MISSION_BRIEFING_COPY, PIECE_LABELS } from "@/lib/content/editorial";
import type { PieceId } from "@/lib/game/types";
import { PrincipalButton } from "@/components/scene-rooted/principal-button";
import { track } from "@/lib/telemetry";

type MissionBriefingProps = {
  pieceType: PieceId;
  targetLabel: string;
  isCapture: boolean;
  onPlay: () => void;
};

export function MissionBriefing({
  pieceType,
  targetLabel,
  isCapture,
  onPlay,
}: MissionBriefingProps) {
  const [exiting, setExiting] = useState(false);
  const playButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    track("modal_open", { id: "mission-briefing", piece: pieceType });
  }, [pieceType]);

  // Autofocus the PLAY CTA. PrincipalButton keeps its API narrow so we
  // focus via ref instead of an `autoFocus` prop.
  useEffect(() => {
    playButtonRef.current?.focus();
  }, []);

  const pieceName = PIECE_LABELS[pieceType] ?? pieceType;
  const objective = isCapture
    ? MISSION_BRIEFING_COPY.captureHint
    : MISSION_BRIEFING_COPY.moveObjective(pieceName, targetLabel);
  const hint = MISSION_BRIEFING_COPY.moveHint[pieceType];

  function handleDismiss() {
    setExiting(true);
    setTimeout(onPlay, 400);
  }

  return (
    /* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */
    <div
      className={`fixed inset-0 z-40 flex items-center justify-center candy-modal-scrim transition-opacity duration-300 ${exiting ? "opacity-0" : "animate-in fade-in duration-300"}`}
      aria-modal="true"
      role="dialog"
      aria-labelledby="mission-briefing-objective"
      onClick={handleDismiss}
    >
      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */}
      <div
        className={`relative mx-4 w-full max-w-[340px] transition-all duration-400 ${exiting ? "scale-95 opacity-0" : "animate-in zoom-in-95 slide-in-from-bottom-4 duration-400"}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Candy panel — cream wood frame + grass border via the
            screen-mission/panel-mision-icon.png asset. Height grows
            with content so adorno + Arena link never get clipped; the
            bg-image is stretched via `100% 100%` so it always fills
            the panel even when content is slightly taller than the
            asset's natural ratio. */}
        <div
          className="relative w-full"
          style={{
            backgroundImage:
              "url('/art/screen-mission/panel-mision-icon.png')",
            backgroundSize: "100% 100%",
            backgroundRepeat: "no-repeat",
          }}
        >
          {/* Inner safe-area inset so content doesn't crash into the
              decorative grass border. Vertical % padding resolves
              against parent inline size (CSS rule) so it stays
              proportional. */}
          <div className="flex flex-col items-center px-[10%] pt-[8%] pb-[7%]">
            {/* Header row — title + close. The title stays as text per
                product call (no MISSION ribbon asset available). */}
            <div className="flex w-full items-center justify-between">
              <h2
                className="fantasy-title text-2xl font-extrabold tracking-wide"
                style={{
                  color: "rgba(63, 34, 8, 0.95)",
                  textShadow: "0 1px 0 rgba(255, 245, 215, 0.7)",
                }}
              >
                {MISSION_BRIEFING_COPY.label}
              </h2>
              <button
                type="button"
                onClick={handleDismiss}
                aria-label="Close"
                className="candy-close-asset-button"
              >
                <img
                  src="/art/screen-mission/close-icon.png"
                  alt=""
                  aria-hidden="true"
                  className="h-10 w-10 object-contain"
                  draggable={false}
                />
              </button>
            </div>

            {/* Avatar — the gold ring is baked into the asset. */}
            <div className="mt-4 flex items-center justify-center">
              <img
                src="/art/screen-mission/avatar-icon.png"
                alt=""
                aria-hidden="true"
                className="h-32 w-32 object-contain drop-shadow-[0_3px_10px_rgba(120,65,5,0.45)]"
                draggable={false}
              />
            </div>

            {/* Objective — large bold, anchors the eye. */}
            <p
              id="mission-briefing-objective"
              className="mt-4 text-center text-xl font-extrabold leading-snug"
              style={{
                color: "rgba(63, 34, 8, 0.95)",
                textShadow: "0 1px 0 rgba(255, 245, 215, 0.7)",
              }}
            >
              {objective}
            </p>

            {/* Hint — secondary, lighter weight. */}
            <p
              className="mt-2 text-center text-sm font-medium"
              style={{
                color: "rgba(110, 65, 15, 0.75)",
                textShadow: "0 1px 0 rgba(255, 245, 215, 0.55)",
              }}
            >
              {hint}
            </p>

            {/* PLAY CTA — size="medium" is 220×64 by default; we
                override with arbitrary utilities so the button reads
                as a compact hero against the avatar above (matches
                the candy reference proportions). */}
            <div className="mt-5 flex w-full justify-center">
              <PrincipalButton
                ref={playButtonRef}
                size="medium"
                onClick={handleDismiss}
                aria-label={MISSION_BRIEFING_COPY.play}
                className="!h-[52px] !w-[180px] !text-base"
              >
                {MISSION_BRIEFING_COPY.play}
              </PrincipalButton>
            </div>

            {/* Decorative crown divider — separates the primary CTA
                from the secondary Arena escape link. */}
            <img
              src="/art/screen-mission/adorno-icon.png"
              alt=""
              aria-hidden="true"
              className="mt-3 h-4 w-44 object-contain"
              draggable={false}
            />

            <Link
              href="/arena"
              className="mt-1 block text-center text-xs font-semibold underline underline-offset-2"
              style={{ color: "rgba(110, 65, 15, 0.70)" }}
            >
              or try {ARENA_COPY.title} vs AI
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
