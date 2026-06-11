"use client";

import { useTranslations } from "next-intl";
import { CandyIcon } from "@/components/redesign/candy-icon";
import type { TrainingNode } from "@/lib/training/path";

type Props = {
  /** Pre-built path from `buildTrainingPath()` — this component only
   *  renders it. Slice 2 is read-only: NO taps, NO navigation, NO
   *  labyrinthMode changes (those land in Slice 3). */
  path: TrainingNode[];
  /** Wallet connection state — gates milestone copy only ("Connect to
   *  claim" vs "Badge ready"), never unlock math. */
  connected: boolean;
  /** Slice 3C: when present, unlocked labyrinth rows become tappable
   *  and report their labyrinthId. Absent → fully read-only rail. */
  onLabyrinthSelect?: (labyrinthId: string) => void;
};

/** Right-hand status cell for labyrinth + milestone rows. Pills follow
 *  the JourneyRail vocabulary (`journey-status-pill` / `journey-row-progress`). */
function StatusCell({
  pill,
  tone,
  text,
}: {
  pill: boolean;
  tone: "done" | "ready" | "neutral";
  text: string;
}) {
  return pill ? (
    <span className="journey-status-pill" data-tone={tone}>
      {text}
    </span>
  ) : (
    <span className="journey-row-progress" data-status="locked">
      {text}
    </span>
  );
}

export function TrainingPathRail({ path, connected, onLabyrinthSelect }: Props) {
  const t = useTranslations("TRAINING_PATH_COPY");

  const exercises = path.filter((node) => node.kind === "exercise");
  const labyrinths = path.filter((node) => node.kind === "labyrinth");
  const badge = path.find((node) => node.kind === "badge");
  const mastery = path.find((node) => node.kind === "mastery");

  return (
    <section aria-label={t("ariaLabel")} className="w-full">
      {/* Exercise leg — compact star chips, one per catalog exercise.
          A wall of 10 identical rows would drown the 340px sheet; the
          chip strip keeps the leg glance-able and scroll-free. */}
      <p className="journey-row-label mb-1">{t("exercisesLabel")}</p>
      <div className="flex flex-wrap gap-1.5">
        {exercises.map((node, index) => (
          <span
            key={node.id}
            data-status={node.status}
            aria-label={t("exerciseChipFormat", {
              number: index + 1,
              stars: node.stars ?? 0,
            })}
            className={`inline-flex h-7 min-w-7 items-center justify-center gap-0.5 rounded-full px-1.5 text-xs font-extrabold ${
              node.status === "complete"
                ? "bg-[rgba(255,214,84,0.85)] text-[rgba(63,34,8,0.95)]"
                : "bg-[rgba(120,65,5,0.12)] text-[rgba(110,65,15,0.55)]"
            }`}
          >
            {node.stars ?? 0}
            <CandyIcon name="star" className="h-3 w-3" />
          </span>
        ))}
      </div>

      {/* Labyrinth leg — the challenge path. Locked copy names the
          exact rule (stars vs previous lab) so a locked row explains
          itself instead of looking broken. */}
      <div className="paper-tray mt-2">
        {labyrinths.map((node, index) => {
          const rowStatus =
            node.status === "complete" ? "done" : node.status === "available" ? "active" : "locked";
          const rowContent = (
            <>
              <span className="journey-row-icon">
                <CandyIcon
                  name={node.status === "locked" ? "lock" : node.status === "complete" ? "check" : "crosshair"}
                  className="h-5 w-5"
                />
              </span>
              <div className="flex-1 min-w-0">
                <p className="journey-row-label">
                  {t("labyrinthLabelFormat", { number: index + 1 })}
                </p>
              </div>
              {node.status === "complete" ? (
                <StatusCell pill tone="done" text={t("starsFormat", { stars: node.stars ?? 0 })} />
              ) : node.status === "available" ? (
                <StatusCell pill tone="ready" text={t("ready")} />
              ) : (
                <StatusCell
                  pill={false}
                  tone="neutral"
                  text={
                    node.unlock.type === "stars"
                      ? t("labyrinthLockedStarsFormat", { stars: node.unlock.min })
                      : t("labyrinthLockedChain")
                  }
                />
              )}
            </>
          );
          // Unlocked labs become buttons ONLY when the parent wires a
          // select handler (Slice 3C). Locked rows stay plain divs —
          // locked must feel locked, not like a broken disabled button.
          return onLabyrinthSelect && node.status !== "locked" ? (
            <button
              key={node.id}
              type="button"
              onClick={() => onLabyrinthSelect(node.id)}
              aria-label={t("labyrinthOpenAriaFormat", { number: index + 1 })}
              className="paper-row journey-row w-full text-left"
              data-status={rowStatus}
            >
              {rowContent}
            </button>
          ) : (
            <div
              key={node.id}
              className="paper-row journey-row"
              data-status={rowStatus}
            >
              {rowContent}
            </div>
          );
        })}
      </div>

      {/* Milestones — a separate group on purpose (red-team P0-3).
          Badge unlocks by stars alone; rendering it inside the rail
          after locked labyrinths would read as a skipped/broken step.
          Each milestone names its own rule instead. */}
      <p className="journey-row-label mt-2 mb-1">{t("milestonesLabel")}</p>
      <div className="paper-tray">
        {badge ? (
          <div
            className="paper-row journey-row"
            data-status={badge.status === "complete" ? "done" : badge.status === "available" ? "active" : "locked"}
          >
            <span className="journey-row-icon">
              <CandyIcon name={badge.status === "locked" ? "lock" : "trophy"} className="h-5 w-5" />
            </span>
            <div className="flex-1 min-w-0">
              <p className="journey-row-label">{t("badgeLabel")}</p>
            </div>
            {badge.status === "complete" ? (
              <StatusCell pill tone="done" text={t("badgeClaimed")} />
            ) : badge.status === "available" ? (
              <StatusCell
                pill
                tone="ready"
                text={connected ? t("badgeReady") : t("badgeConnect")}
              />
            ) : (
              <StatusCell
                pill={false}
                tone="neutral"
                text={t("badgeLockedFormat", {
                  stars: badge.unlock.type === "stars" ? badge.unlock.min : 10,
                })}
              />
            )}
          </div>
        ) : null}
        {mastery ? (
          <div
            className="paper-row journey-row"
            data-status={mastery.status === "complete" ? "done" : mastery.status === "available" ? "active" : "locked"}
          >
            <span className="journey-row-icon">
              <CandyIcon name={mastery.status === "complete" ? "crown" : "lock"} className="h-5 w-5" />
            </span>
            <div className="flex-1 min-w-0">
              <p className="journey-row-label">{t("masteryLabel")}</p>
            </div>
            {mastery.status === "complete" ? (
              <StatusCell pill tone="done" text={t("masteryComplete")} />
            ) : (
              <StatusCell
                pill={false}
                tone="neutral"
                text={mastery.status === "available" ? t("masteryAlmost") : t("masteryLocked")}
              />
            )}
          </div>
        ) : null}
      </div>
    </section>
  );
}
