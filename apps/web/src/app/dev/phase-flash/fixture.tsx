"use client";

import { PhaseFlash } from "@/components/exercises/mission-panel-candy";
import type { TrainingConsequence } from "@/lib/training/consequence";

export type PhaseFlashVariant = "success-plain" | "success-consequence";

/**
 * Success-flash dev fixture — the exercise completion surface (Paso 1, slice
 * 1C). Two variants, and the pair is the point: `success-plain` is the flash
 * exactly as it shipped before this feature, `success-consequence` is the same
 * flash with the line. A diff between their baselines is the only proof that
 * AC-2 holds — that without a consequence, nothing on this surface moved.
 *
 * ⚠️ The consequence is passed HERE, deliberately. A fixture that omits the
 * prop photographs less than what ships, and its baseline stays green through
 * the entire feature — which is exactly what happened to the labyrinth
 * baseline on 2026-08-08 until the PNG was opened by hand.
 *
 * `awaitTap` holds the flash open indefinitely instead of auto-dismissing at
 * ~3.7s, so the screenshot cannot race the fade-out.
 */
const CONSEQUENCE: TrainingConsequence = {
  kind: "badge_progress",
  done: 7,
  required: 8,
};

export function PhaseFlashFixture({ variant }: { variant: PhaseFlashVariant }) {
  return (
    <main
      data-testid="dev-phase-flash-root"
      className="arena-bg relative min-h-[100dvh] w-full"
    >
      <PhaseFlash
        phase="success"
        lessonTitle="Move along the rank"
        streakCount={3}
        lastEarnedStars={2}
        awaitTap
        onContinue={() => {}}
        consequence={variant === "success-consequence" ? CONSEQUENCE : null}
      />
    </main>
  );
}
