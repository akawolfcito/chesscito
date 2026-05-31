"use client";

import { FailRescueModal } from "@/components/exercises/fail-rescue-modal";
import type { RescueModalVariant } from "@/lib/exercises/use-rescue-modal-state";

/**
 * FailRescueModal dev fixture — renders one variant at a time over the
 * scrim color the production PhaseFlash uses. Commit 10's VR baselines
 * snapshot ?variant=A|B|C|D against this surface to lock in the modal
 * visual.
 */
export function RescueModalFixture({
  variant,
  shieldsCount,
}: {
  variant: RescueModalVariant;
  shieldsCount: number;
}) {
  return (
    <main
      data-testid="dev-rescue-modal-root"
      className="relative flex min-h-[100dvh] w-full items-center justify-center"
      style={{
        // Mirror PhaseFlash scrim so the modal lands on the same
        // visual canvas it will inherit in production (commit 8).
        background:
          "radial-gradient(circle at 50% 40%, rgba(63, 34, 8, 0.55) 0%, rgba(63, 34, 8, 0.85) 70%)",
      }}
    >
      <FailRescueModal
        visible
        variant={variant}
        shieldsCount={shieldsCount}
        onUseShield={() => {}}
        onRetryAnyway={() => {}}
        onClaimFree={() => {}}
        onGetShields={() => {}}
      />
    </main>
  );
}
