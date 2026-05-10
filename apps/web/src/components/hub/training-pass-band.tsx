"use client";

import { useEffect, useRef } from "react";

import { HUB_V2_TRAINING_COPY } from "@/lib/content/editorial";
import { track } from "@/lib/telemetry";

/** Hub V2 Training Pass band primitive (design-lock §1.5 + §9.4).
 *
 *  Two visual states sharing one tap surface:
 *    - active   → kicker + days + sessions progress + renews date
 *                 (visual coupling to `<WoodBanner size="medium">` +
 *                  warm-wood texture lands in Phase 7)
 *    - inactive → title + price + 3 perks
 *                 (visual coupling to `<TreasureTile size="large">` +
 *                  chest art lands in Phase 7)
 *
 *  Telemetry: `hub_v2_training_band_tap { proActive }` on every tap
 *  (design-lock §5).
 *
 *  Atmosphere shift orchestration: the band exposes an `onActivate`
 *  callback that fires once on the `active: false → true` transition
 *  (NOT on initial mount). The actual `hub_atmosphere_shift` telemetry
 *  + state change live in `<HubScaffoldV2Client>` (Phase 3 commit 1) —
 *  Phase 7 wires `band.onActivate` into the scaffold if a band-driven
 *  trigger is needed beyond the existing ProSheet receipt path. */

export type TrainingPassBandProps = {
  active: boolean;
  /** Required when active=true. */
  daysRemaining?: number;
  /** Required when active=true. */
  sessionsUsed?: number;
  /** Required when active=true. */
  sessionsTotal?: number;
  /** Required when active=true. mm/dd format. */
  renewsAt?: string;
  onTap: () => void;
  /** Fires once when `active` transitions false → true. NOT on mount. */
  onActivate?: () => void;
  /** Optional legacy/integration test anchor for the owning scaffold. */
  testId?: string;
};

export function TrainingPassBand({
  active,
  daysRemaining,
  sessionsUsed,
  sessionsTotal,
  renewsAt,
  onTap,
  onActivate,
  testId,
}: TrainingPassBandProps) {
  const prevActiveRef = useRef<boolean>(active);
  const onActivateRef = useRef<typeof onActivate>(onActivate);

  useEffect(() => {
    onActivateRef.current = onActivate;
  });

  useEffect(() => {
    if (active && !prevActiveRef.current) {
      onActivateRef.current?.();
    }
    prevActiveRef.current = active;
  }, [active]);

  const handleTap = () => {
    track("hub_v2_training_band_tap", { proActive: active });
    onTap();
  };

  if (active) {
    const days = daysRemaining ?? 0;
    const used = sessionsUsed ?? 0;
    const total = sessionsTotal ?? 0;
    const renews = renewsAt ?? "";
    return (
      <button
        type="button"
        data-testid={testId}
        data-component="training-pass-band"
        data-state="active"
        className="training-pass-band is-active"
        aria-label={HUB_V2_TRAINING_COPY.active.ariaLabel(days, used, total)}
        onClick={handleTap}
      >
        <span data-testid="band-kicker" className="training-pass-band-kicker">
          {HUB_V2_TRAINING_COPY.active.kicker}
        </span>
        <span data-testid="band-days" className="training-pass-band-days">
          {HUB_V2_TRAINING_COPY.active.daysFormat(days)}
        </span>
        <span
          data-testid="band-sessions"
          className="training-pass-band-sessions"
        >
          {HUB_V2_TRAINING_COPY.active.sessionsFormat(used, total)}
        </span>
        <span data-testid="band-renews" className="training-pass-band-renews">
          {HUB_V2_TRAINING_COPY.active.renewsFormat(renews)}
        </span>
      </button>
    );
  }

  return (
    <button
      type="button"
      data-testid={testId}
      data-component="training-pass-band"
      data-state="inactive"
      className="training-pass-band is-inactive"
      aria-label={HUB_V2_TRAINING_COPY.inactive.ariaLabel}
      onClick={handleTap}
    >
      <span data-testid="band-title" className="training-pass-band-title">
        {HUB_V2_TRAINING_COPY.inactive.title}
      </span>
      <span data-testid="band-price" className="training-pass-band-price">
        {HUB_V2_TRAINING_COPY.inactive.priceLabel}
      </span>
      <ul className="training-pass-band-perks">
        {HUB_V2_TRAINING_COPY.inactive.perks.map((perk) => (
          <li
            key={perk}
            data-testid="band-perk"
            className="training-pass-band-perk"
          >
            {perk}
          </li>
        ))}
      </ul>
    </button>
  );
}
