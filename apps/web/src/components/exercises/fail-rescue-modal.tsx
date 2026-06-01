"use client";

import { useTranslations } from "next-intl";
import type { RescueModalVariant } from "@/lib/exercises/use-rescue-modal-state";

/**
 * FailRescueModal — decision panel shown when the player fails an
 * exercise. Visual contract redesigned 2026-05-31 to match the
 * VictoryPopupShell vocabulary (green frame, leafy corners, cream
 * paper interior, candy-pill primary CTA, sad-wolf anchor on the
 * right) so the player reads it as a sibling of the win/loss popups
 * rather than a separate modal class.
 *
 * Spec: _bmad-output/planning-artifacts/ux-shield-rescue-and-welcome-
 * pack-2026-05-31.md §3 (rescue flow). UX polish iteration adds the
 * kicker context label + stats pill row + footer hint per user
 * feedback 2026-05-31 (Image #6 + #7 references).
 *
 * Layout:
 *   [✕]                                   ┐
 *                                          │ kicker (ALL CAPS subtitle)
 *           ALMOST.                        │ heading
 *     body line · 2-3 sentences            │ body
 *                                          │
 *   [ Shield · N left ] [ Gift/Star pill ] │ stats pills row
 *                                          │       wolf avatar on right
 *                                          │       (absolute positioned)
 *
 *   ┌──────────────────────────────────┐
 *   │  PRIMARY CTA (Use / Claim / Get) │  primary candy-pill
 *   └──────────────────────────────────┘
 *   ┌──────────────────────────────────┐
 *   │       Retry anyway               │  secondary outlined
 *   └──────────────────────────────────┘
 *
 *   small footer hint                    │ ("We'll take you to the Shop." / "Keep your streak alive.")
 *
 * Six locked behavior decisions remain (§3.2):
 *   1. No autodismiss
 *   2. Backdrop tap does NOTHING (X or Retry anyway only)
 *   3. X and Retry anyway → same outcome (DRY handler)
 *   4. Same handler under the hood
 *   5. HUD damage-pulse on Use Shield (commit 9)
 *   6. Architecture: PhaseFlash hosts the modal (commit 8)
 */

export type FailRescueModalProps = {
  visible: boolean;
  variant: RescueModalVariant;
  /** Live shield count. Drives the "Shield · N left" pill + the
   *  "Use Shield · N left" chip on the primary CTA when applicable. */
  shieldsCount: number;
  /** Tap "Use Shield" — required for variants A/B. */
  onUseShield: () => void;
  /** Tap "Retry anyway" or X (same handler — see decision §3). */
  onRetryAnyway: () => void;
  /** Tap "Claim free" deep link — only consumed by variant C. */
  onClaimFree: () => void;
  /** Tap "Get Shields" deep link — only consumed by variant D. */
  onGetShields: () => void;
};

const WELCOME_PACK_GIFT_COUNT = 3;

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
  const kicker = hasShields
    ? tRescue("kicker.withShields")
    : tRescue("kicker.withoutShields");
  const footer = hasShields
    ? tRescue("footer.withShields")
    : tRescue("footer.deepLink");

  // Primary CTA — different label + handler per variant. Reuses the
  // FOOTER_CTA_COPY.useShield + shieldsLeft(n) keys for the with-
  // shields path so the label matches every other "Use Shield"
  // surface in the app.
  let primaryLabel: string;
  let primaryChip: string | null = null;
  let primaryAction: () => void;
  if (hasShields) {
    primaryLabel = tFooter("useShield.label");
    primaryChip = tFooter("shieldsLeft", { n: shieldsCount });
    primaryAction = onUseShield;
  } else if (variant === "C") {
    primaryLabel = tRescue("cta.claimShields", { n: WELCOME_PACK_GIFT_COUNT });
    primaryAction = onClaimFree;
  } else {
    primaryLabel = tRescue("cta.getShields");
    primaryAction = onGetShields;
  }

  // Stats pills — left to right. Shield count is always shown
  // (with N=0 in variants C/D making the "out of shields" state
  // concrete). The companion pill differs by variant:
  //   - with shields → "Star protected"
  //   - variant C → "Gift · 3 free"
  //   - variant D → omitted (no welcome pack pitch left)
  const shieldPillText = tRescue("pills.shieldCount", { n: shieldsCount });
  let companionPillText: string | null = null;
  if (hasShields) {
    companionPillText = tRescue("pills.starProtected");
  } else if (variant === "C") {
    companionPillText = tRescue("pills.giftCount", {
      n: WELCOME_PACK_GIFT_COUNT,
    });
  }

  return (
    /* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */
    <div
      className="candy-modal-scrim pointer-events-auto fixed inset-0 z-[70] flex items-center justify-center animate-in fade-in duration-300"
      role="dialog"
      aria-modal="true"
      aria-labelledby="fail-rescue-modal-header"
      data-variant={variant}
    >
      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */}
      <div
        className="fail-rescue-modal-panel relative mx-4 w-full max-w-[340px] max-h-[92dvh] overflow-y-auto overscroll-contain"
        onClick={(e) => e.stopPropagation()}
        style={{
          backgroundImage:
            'image-set(url("/art/new-assets-chesscito/paneles/panel-bg1.avif") type("image/avif"), url("/art/new-assets-chesscito/paneles/panel-bg1.webp") type("image/webp"), url("/art/new-assets-chesscito/paneles/panel-bg1.png") type("image/png"))',
          backgroundSize: "100% 100%",
          backgroundRepeat: "no-repeat",
        }}
      >
        <button
          type="button"
          onClick={onRetryAnyway}
          aria-label={tRescue("closeLabel")}
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

        <div className="fail-rescue-modal-content">
          <p className="fail-rescue-modal-kicker">{kicker}</p>
          <p
            id="fail-rescue-modal-header"
            className="fail-rescue-modal-heading"
          >
            {tRescue("header")}
          </p>
          <p className="fail-rescue-modal-body">
            {tRescue(bodyKeyForVariant(variant))}
          </p>

          <div
            className="fail-rescue-modal-stats-row"
            aria-hidden="true"
          >
            <span className="fail-rescue-modal-stat-pill">
              <picture className="fail-rescue-modal-stat-icon">
                <source
                  srcSet="/art/redesign/icons/shield.avif"
                  type="image/avif"
                />
                <source
                  srcSet="/art/redesign/icons/shield.webp"
                  type="image/webp"
                />
                <img
                  src="/art/redesign/icons/shield.png"
                  alt=""
                  aria-hidden="true"
                  draggable={false}
                />
              </picture>
              <span>{shieldPillText}</span>
            </span>
            {companionPillText ? (
              <span className="fail-rescue-modal-stat-pill">
                {hasShields ? (
                  <picture className="fail-rescue-modal-stat-icon">
                    <source
                      srcSet="/art/redesign/icons/star.avif"
                      type="image/avif"
                    />
                    <source
                      srcSet="/art/redesign/icons/star.webp"
                      type="image/webp"
                    />
                    <img
                      src="/art/redesign/icons/star.png"
                      alt=""
                      aria-hidden="true"
                      draggable={false}
                    />
                  </picture>
                ) : (
                  <span
                    className="fail-rescue-modal-stat-icon-glyph"
                    aria-hidden="true"
                  >
                    🎁
                  </span>
                )}
                <span>{companionPillText}</span>
              </span>
            ) : null}
          </div>

          {/* Wolf avatar anchored on the right — same sad-mascot the
              prior PhaseFlash used. Positioned absolute so it
              overhangs the stats row without affecting the CTA's
              full-width layout. */}
          <picture className="fail-rescue-modal-wolf">
            <source
              srcSet="/art/avatar-try-again.avif"
              type="image/avif"
            />
            <source
              srcSet="/art/avatar-try-again.webp"
              type="image/webp"
            />
            <img
              src="/art/avatar-try-again.png"
              alt=""
              aria-hidden="true"
              draggable={false}
            />
          </picture>

          <div className="fail-rescue-modal-cta-stack">
            <button
              type="button"
              className="fail-rescue-modal-primary"
              onClick={primaryAction}
              aria-label={
                primaryChip ? `${primaryLabel} · ${primaryChip}` : primaryLabel
              }
            >
              <span className="fail-rescue-modal-primary-label">
                {primaryLabel}
              </span>
              {primaryChip ? (
                <span className="fail-rescue-modal-primary-chip">
                  {primaryChip}
                </span>
              ) : null}
            </button>

            <button
              type="button"
              className="fail-rescue-modal-secondary"
              onClick={onRetryAnyway}
            >
              {tRescue("cta.retryAnyway")}
            </button>

            <p className="fail-rescue-modal-footer">{footer}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
