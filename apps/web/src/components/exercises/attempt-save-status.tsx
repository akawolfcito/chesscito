"use client";

/**
 * The attempt queue, made visible (Slice 3, stage 4C-3).
 *
 * WHAT IT IS ALLOWED TO DO
 * ------------------------
 * Read `status` and `pendingCount`, and call `retry`. That is the whole
 * contract. It does NOT mint, rebuild, reorder or drop anything: the queue is
 * the hook's, and a UI that could touch it would be a second writer to a
 * structure whose entire guarantee is "an attempt survives until the SERVER
 * confirms it".
 *
 * WHY NOT A TOAST, AND WHY NOT A MODAL
 * ------------------------------------
 * A toast expires — usually while the player is mid-move, which is exactly when
 * the network is bad and this state exists. A modal takes the board away to
 * report something the player did not do wrong and cannot fix by stopping. So
 * it is a line that stays until the queue drains.
 *
 * WHY IT FLOATS, AND WHY IT OFFERS (founder 2026-08-09)
 * ----------------------------------------------------
 * It used to sit in normal flow above the mission panel, which meant it SHOVED
 * the board down the screen every time the network hiccuped — a non-blocking
 * message charging the player 60px of the thing he came for. It is fixed now:
 * same persistence, zero layout cost.
 *
 * And it stopped accusing. "Your last attempt hasn't been saved yet" words a
 * WIN as a debt. Nothing here blocks him — the attempt is safe in the queue and
 * he can keep playing either way — so the line names what he earned and offers
 * to bank it. The CTA is "Save", not "Retry": retry names a failure he did not
 * cause.
 *
 * `aria-live="polite"` and no `role="alert"`: it is worth announcing, not worth
 * interrupting. (And `role="alert"` is precisely what made a previous overlay
 * invisible to the "one modal at a time" guard.)
 */

import { useTranslations } from "next-intl";

import type { AttemptOutboxStatus } from "@/lib/scores/use-attempt-outbox";

type Props = {
  status: AttemptOutboxStatus;
  pendingCount: number;
  onRetry: () => void;
};

export function AttemptSaveStatus({ status, pendingCount, onRetry }: Props) {
  const t = useTranslations("ATTEMPT_SAVE_COPY");

  // Nothing waiting, nothing to say. The queue being empty is the normal case
  // and it must be silent — a permanent "all saved" chip would train the player
  // to stop reading the line that matters.
  if (pendingCount <= 0) return null;

  const failed = status === "failed";
  const message = failed
    ? pendingCount > 1
      ? t("failedCountFormat", { count: pendingCount })
      : t("failed")
    : pendingCount > 1
      ? t("savingCountFormat", { count: pendingCount })
      : t("saving");

  return (
    <div
      className={`attempt-save-status is-floating${failed ? " is-failed" : ""}`}
      aria-live="polite"
      data-testid="attempt-save-status"
    >
      <span className="attempt-save-status__message">{message}</span>
      {/* The CTA exists only for a PARKED queue. While a delivery is in flight
          there is nothing to retry, and offering it would invite a second POST
          of an attempt the server is already answering. */}
      {failed ? (
        <button
          type="button"
          className="attempt-save-status__cta"
          aria-label={t("retryAriaLabel")}
          onClick={onRetry}
        >
          {t("retryCta")}
        </button>
      ) : null}
    </div>
  );
}
