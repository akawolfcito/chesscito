"use client";

import { ARENA_COPY } from "@/lib/content/editorial";

type CoachPreviewCardProps = {
  proActive: boolean;
  difficultyLabel: string;
  resultLabel: string;
  moveCount: number;
  onPrimaryCta: () => void;
  isCompact?: boolean;
};

export function CoachPreviewCard({
  proActive,
  difficultyLabel,
  resultLabel,
  moveCount,
  onPrimaryCta,
  isCompact,
}: CoachPreviewCardProps) {
  const copy = ARENA_COPY.coachPreview;

  return (
    <section
      className={`coach-preview-card${proActive ? " is-active" : " is-inactive"}${isCompact ? " is-compact" : ""}`}
      aria-label={proActive ? copy.activeTitle : copy.inactiveTitle}
      data-testid="coach-preview-card"
    >
      <div className="coach-preview-card-copy">
        <span className="coach-preview-card-kicker">Coach Review</span>
        <h3 className="coach-preview-card-title">
          {proActive ? copy.activeTitle : copy.inactiveTitle}
        </h3>
        <p className="coach-preview-card-body">
          {proActive
            ? copy.activeBody
            : copy.insight(difficultyLabel, resultLabel, moveCount)}
        </p>
        {!proActive ? (
          <div className="coach-preview-card-chips" aria-label="Full review includes">
            {copy.lockedBenefits.map((benefit) => (
              <span className="coach-preview-card-chip" key={benefit}>
                {benefit}
              </span>
            ))}
          </div>
        ) : null}
      </div>
      <button
        type="button"
        className="coach-preview-card-cta"
        onClick={onPrimaryCta}
      >
        {proActive ? copy.activeCta : copy.inactiveCta}
      </button>
    </section>
  );
}
