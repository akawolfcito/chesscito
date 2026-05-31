"use client";

import { useTranslations } from "next-intl";
import type { RescueModalVariant } from "@/lib/exercises/use-rescue-modal-state";

/**
 * FailRescueModal — the decision overlay that mounts AFTER the
 * PhaseFlash failure entry animation completes (1800ms). Same screen
 * visual continuity: scrim stays, wolf + "Try again" banner stay,
 * CTAs slide-up underneath the wolf.
 *
 * Spec: _bmad-output/planning-artifacts/ux-shield-rescue-and-welcome-
 * pack-2026-05-31.md §3.4 (copy) + §3.5 (animation) + §3.7 (reuse
 * .candy-close-asset-button from victory-popup-shell.tsx).
 *
 * Six locked behavior decisions (§3.2):
 *   1. No autodismiss timer — waits indefinitely
 *   2. Backdrop tap does NOTHING (only X or "Retry anyway" close)
 *   3. X and "Retry anyway" produce the SAME outcome (DRY handler)
 *   4. Same handler for X / Retry; do not distinguish
 *   5. Shield count animation: static sprite swap (handled by HUD)
 *   6. Architecture: PhaseFlash extended (commit 8 wires this)
 *
 * Phase-1 commit 7: this component is STANDALONE — mountable by dev
 * fixtures + visible in VR baselines without touching PhaseFlash.
 * Commit 8 wires it into the real failure flow.
 */

export type FailRescueModalProps = {
  visible: boolean;
  variant: RescueModalVariant;
  /** Live shield count for the "{N} left" chip. Only consumed by
   *  variants A/B (with-shields). */
  shieldsCount: number;
  /** Tap "Use Shield" — required for variants A/B. */
  onUseShield: () => void;
  /** Tap "Retry anyway" or X (same handler — see decision #3). */
  onRetryAnyway: () => void;
  /** Tap "Claim free" deep link — only consumed by variant C. */
  onClaimFree: () => void;
  /** Tap "Get Shields" deep link — only consumed by variant D. */
  onGetShields: () => void;
};

function bodyKeyForVariant(variant: RescueModalVariant): string {
  switch (variant) {
    case "A":
      return "body.withShieldsFirst";
    case "B":
      return "body.withShieldsRecurring";
    case "C":
      return "body.withoutShieldsPreClaim";
    case "D":
      return "body.withoutShieldsPostClaim";
  }
}

export function FailRescueModal({
  visible,
  variant,
  shieldsCount,
  onUseShield,
  onRetryAnyway,
  onClaimFree,
  onGetShields,
}: FailRescueModalProps) {
  const tRescue = useTranslations("RESCUE_MODAL_COPY");
  const tFooter = useTranslations("FOOTER_CTA_COPY");

  if (!visible) return null;

  const hasShields = variant === "A" || variant === "B";

  // Primary CTA varies by variant; reuses existing FOOTER_CTA_COPY
  // keys for the with-shields cases so the label matches every other
  // "Use Shield" surface in the app.
  let primaryLabel: string;
  let primarySubtitle: string | null = null;
  let primaryAction: () => void;

  if (hasShields) {
    primaryLabel = tFooter("useShield.label");
    primarySubtitle = tFooter("shieldsLeft", { n: shieldsCount });
    primaryAction = onUseShield;
  } else if (variant === "C") {
    primaryLabel = tRescue("cta.claimFree");
    primarySubtitle = tRescue("cta.claimFreeSubtitle");
    primaryAction = onClaimFree;
  } else {
    primaryLabel = tRescue("cta.getShields");
    primaryAction = onGetShields;
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="fail-rescue-modal-header"
      className="fail-rescue-modal"
      data-variant={variant}
    >
      {/* X close — top-right. Reuses the .candy-close-asset-button
       *  sprite + a11y pattern from victory-popup-shell.tsx:71-77
       *  (same sprite, same tap target). Same outcome as Retry
       *  anyway (decision §3.2 #3). */}
      <button
        type="button"
        onClick={onRetryAnyway}
        aria-label={tRescue("closeLabel")}
        className="candy-close-asset-button fail-rescue-modal-close"
      >
        <picture>
          <source srcSet="/art/screen-mission/close-icon.avif" type="image/avif" />
          <source srcSet="/art/screen-mission/close-icon.webp" type="image/webp" />
          <img
            src="/art/screen-mission/close-icon.png"
            alt=""
            aria-hidden="true"
            className="h-8 w-8 object-contain"
            draggable={false}
          />
        </picture>
      </button>

      <div className="fail-rescue-modal-stack">
        <p
          id="fail-rescue-modal-header"
          className="fail-rescue-modal-header"
        >
          {tRescue("header")}
        </p>
        <p className="fail-rescue-modal-body">{tRescue(bodyKeyForVariant(variant))}</p>

        <div className="fail-rescue-modal-cta-row">
          <button
            type="button"
            className="candy-tray-pill fail-rescue-modal-primary"
            onClick={primaryAction}
            aria-label={
              primarySubtitle ? `${primaryLabel} · ${primarySubtitle}` : primaryLabel
            }
          >
            <span className="fail-rescue-modal-primary-label">{primaryLabel}</span>
            {primarySubtitle ? (
              <span className="fail-rescue-modal-primary-chip">{primarySubtitle}</span>
            ) : null}
          </button>

          <button
            type="button"
            className="fail-rescue-modal-secondary"
            onClick={onRetryAnyway}
          >
            {tRescue("cta.retryAnyway")}
          </button>
        </div>
      </div>
    </div>
  );
}
