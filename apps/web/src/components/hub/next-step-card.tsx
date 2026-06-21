"use client";

import Link from "next/link";
import type { ContentLoopAction } from "@/lib/hub/content-loop";

type NextStepCardProps = {
  action: ContentLoopAction;
  /** Card renders null until all Content Loop inputs are hydrated from
   *  localStorage. This prevents a flash of the wrong variant on first render. */
  isHydrated: boolean;
};

/**
 * Lightweight "Next Best Action" card for Chesscito Lite.
 * Rendered below Focus Passport in hub-scaffold-center-stack.
 *
 * Spec: docs/specs/content-loop-v1.md §7
 */
export function NextStepCard({ action, isHydrated }: NextStepCardProps) {
  if (!isHydrated) return null;

  const { variant, destination, ctaEN, subEN } = action;
  const isMicro = variant === "view-progress";

  return (
    <div
      className={`next-step-card${isMicro ? " next-step-card--micro" : ""}`}
      data-testid="next-step-card"
      data-variant={variant}
    >
      <span className="next-step-card-sub">{subEN}</span>
      {destination ? (
        <Link href={destination} className="next-step-card-cta">
          {ctaEN}
        </Link>
      ) : (
        <span className="next-step-card-cta next-step-card-cta--static">{ctaEN}</span>
      )}
    </div>
  );
}
