"use client";

import { useTranslations } from "next-intl";
import { VictoryPopupShell } from "@/components/arena/victory-popup-shell";
import { PrincipalButton } from "@/components/scene-rooted/principal-button";
import type { CelebrationStep } from "@/lib/progression/celebration-queue";
import type { MilestoneId } from "@/lib/progression/types";

/** Canonical existing assets that best represent each earned artifact.
 *  The earned thing replaces the wolf mascot as the central icon so the
 *  player sees WHAT they won, not a generic mascot. Verified against
 *  apps/web/public/art/** before wiring — no new art was created. */
const ICONS: Partial<Record<MilestoneId, string>> = {
  "first-reward": "/art/welcome-package/focus-stamp-day1",
  "first-labyrinth": "/art/new-icons-chesscito/laberinto",
  "special-training": "/art/new-icons-chesscito/training-icon-v1",
  "piece-badge-eligible": "/art/new-icons-chesscito/badge-claim-icon",
  mastery: "/art/redesign/icons/crown",
  "great-focus-session": "/art/achievements/1day-focus",
};

type Props = {
  step: CelebrationStep;
  onPrimary: () => void;
  onDismiss: () => void;
};

/**
 * Shared unlock overlay for the progression milestone machine.
 *
 * One dialog, always. A lower major absorbed into this step (e.g. Great
 * Focus Session firing alongside Piece Mastered) renders as a line INSIDE
 * this overlay, never as a second modal stacked after it — showing
 * MASTERY! and then GREAT FOCUS SESSION! would drop the intensity right
 * after the climax.
 */
export function UnlockOverlay({ step, onPrimary, onDismiss }: Props) {
  const t = useTranslations("PROGRESSION_COPY");
  if (!t.has(`${step.id}.title`)) return null;

  const icon = ICONS[step.id];

  /**
   * Per-piece copy wins when it exists; the milestone's generic line is the
   * fallback. A milestone-keyed string cannot know which game the player just
   * unlocked, which is how "Guide the rook through it" ended up greeting the
   * queen (founder, 2026-07-16) — so where the piece is known and the copy
   * exists, the piece's own words are the truthful ones.
   */
  const copy = (field: "title" | "body" | "primary") => {
    const scoped = `${step.id}.byPiece.${step.piece}.${field}`;
    return step.piece && t.has(scoped) ? t(scoped) : t(`${step.id}.${field}`);
  };

  return (
    <VictoryPopupShell
      onClose={onDismiss}
      ariaLabel={copy("title")}
      closeLabel={t("closeLabel")}
    >
      {icon ? (
        <div className="progression-overlay-icon">
          <picture>
            <source srcSet={`${icon}.avif`} type="image/avif" />
            <source srcSet={`${icon}.webp`} type="image/webp" />
            <img
              src={`${icon}.png`}
              alt=""
              aria-hidden="true"
              className="h-20 w-20 object-contain"
              draggable={false}
            />
          </picture>
        </div>
      ) : null}

      <h2 className="language-modal-title">{copy("title")}</h2>
      <p className="progression-overlay-body">{copy("body")}</p>

      {step.absorbed.map((event) => {
        const key = `absorbed.${event.id}`;
        return t.has(key) ? (
          <p key={event.id} className="progression-overlay-absorbed">
            {t(key)}
          </p>
        ) : null;
      })}

      <PrincipalButton onClick={onPrimary} className="self-center">
        {copy("primary")}
      </PrincipalButton>
      <button
        type="button"
        onClick={onDismiss}
        className="progression-overlay-dismiss"
      >
        {t(`${step.id}.dismiss`)}
      </button>
    </VictoryPopupShell>
  );
}
