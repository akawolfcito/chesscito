"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";

import type { PieceId } from "@/lib/game/types";
import { PrincipalButton } from "@/components/scene-rooted/principal-button";
import { track } from "@/lib/telemetry";

type MissionBriefingProps = {
  pieceType: PieceId;
  targetLabel: string;
  isCapture: boolean;
  onPlay: () => void;
};

/** Mount guard for the first-visit briefing. The briefing DEFERS (stays
 *  pending, `showBriefing` keeps true) while any covering surface is
 *  open — dock/PRO/account sheets — AND while the labyrinth layer is
 *  active: the exercise objective copy would interpolate the live
 *  labyrinth move counter ("Move your Rook to 0 / 3 moves"). It mounts
 *  naturally once the player is back on a clear exercise view. */
export function shouldShowMissionBriefing(args: {
  showBriefing: boolean;
  dockSheetOpen: boolean;
  proSheetOpen: boolean;
  accountSheetOpen: boolean;
  labyrinthActive: boolean;
}): boolean {
  return (
    args.showBriefing &&
    !args.dockSheetOpen &&
    !args.proSheetOpen &&
    !args.accountSheetOpen &&
    !args.labyrinthActive
  );
}

export function MissionBriefing({
  pieceType,
  targetLabel,
  isCapture,
  onPlay,
}: MissionBriefingProps) {
  const t = useTranslations("MISSION_BRIEFING_COPY");
  const tPiece = useTranslations("PIECE_LABELS");
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

  const pieceName = (() => {
    try {
      return tPiece(pieceType);
    } catch {
      return pieceType;
    }
  })();
  const objective = isCapture
    ? t("captureHint")
    : t("moveObjective", { piece: pieceName, target: targetLabel });
  const hint = t(`moveHint.${pieceType}`);

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
              'image-set(url("/art/screen-mission/panel-mision-icon.avif") type("image/avif"), url("/art/screen-mission/panel-mision-icon.webp") type("image/webp"), url("/art/screen-mission/panel-mision-icon.png") type("image/png"))',
            backgroundSize: "100% 100%",
            backgroundRepeat: "no-repeat",
            minHeight: "280px",
          }}
        >
          {/* Close button is positioned absolutely against the panel
              frame so it lives in the actual top-right corner (outside
              the inner safe-area inset). Touch target stays 44×44 via
              .candy-close-asset-button. */}
          <button
            type="button"
            onClick={handleDismiss}
            aria-label={t("closeLabel")}
            className="candy-close-asset-button absolute right-[4%] top-[4%] z-10"
          >
            <picture>
              <source
                srcSet="/art/screen-mission/close-icon.avif"
                type="image/avif"
              />
              <source
                srcSet="/art/screen-mission/close-icon.webp"
                type="image/webp"
              />
              <img
                src="/art/screen-mission/close-icon.png"
                alt=""
                aria-hidden="true"
                className="h-10 w-10 object-contain"
                draggable={false}
              />
            </picture>
          </button>
          {/* Inner safe-area inset so content doesn't crash into the
              decorative grass border. Vertical % padding resolves
              against parent inline size (CSS rule) so it stays
              proportional. */}
          <div className="flex flex-col items-center px-[10%] pt-[8%] pb-[7%]">
            {/* Header row — title only. The close button lives above
                as an absolute sibling so it can hug the panel corner. */}
            <div className="flex w-full items-center">
              <h2
                className="fantasy-title text-2xl font-extrabold tracking-wide"
                style={{
                  color: "rgba(63, 34, 8, 0.95)",
                  textShadow: "0 1px 0 rgba(255, 245, 215, 0.7)",
                }}
              >
                {t("label")}
              </h2>
            </div>

            {/* Avatar — the gold ring is baked into the asset. */}
            <div className="mt-4 flex items-center justify-center">
              <picture>
                <source
                  srcSet="/art/screen-mission/avatar-icon.avif"
                  type="image/avif"
                />
                <source
                  srcSet="/art/screen-mission/avatar-icon.webp"
                  type="image/webp"
                />
                <img
                  src="/art/screen-mission/avatar-icon.png"
                  alt=""
                  aria-hidden="true"
                  className="h-32 w-32 object-contain drop-shadow-[0_3px_10px_rgba(120,65,5,0.45)]"
                  draggable={false}
                />
              </picture>
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
                aria-label={t("play")}
                className="!h-[52px] !w-[180px] !text-base"
              >
                {t("play")}
              </PrincipalButton>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
