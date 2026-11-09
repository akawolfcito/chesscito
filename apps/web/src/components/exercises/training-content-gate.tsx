"use client";

import type { ReactNode } from "react";

import type { Exercise } from "@/lib/game/types";
import {
  canMountTrainingContent,
  isContentAccessPending,
  resolveContentAccess,
  type EffectiveTrainingPassSnapshot,
} from "@/lib/training/content-access";

export function TrainingContentGate({
  content,
  trainingPass,
  attemptGrantId,
  children,
}: {
  content: Exercise;
  trainingPass: EffectiveTrainingPassSnapshot;
  attemptGrantId: string | null;
  children: ReactNode;
}) {
  if (
    canMountTrainingContent({ content, trainingPass, attemptGrantId })
  ) {
    return <>{children}</>;
  }

  const access = resolveContentAccess(content, trainingPass);
  if (isContentAccessPending(access)) {
    return (
      <div
        aria-busy="true"
        data-testid="training-content-access-loading"
        className="min-h-[18rem] w-full"
      />
    );
  }

  // Denial renders neither game nor commercial overlay. The host returns to
  // the locked Path; only a later explicit node tap may open checkout.
  return null;
}
